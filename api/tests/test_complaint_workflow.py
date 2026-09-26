"""
Automated tests for the complaint workflow rules.

These tests exercise the REAL workflow modules
(api.workflow, api.assignment, api.agent, api.review,
api.activity) against in-memory fake Mongo collections, so
they run without a live MongoDB instance.

Run:
    MONGO_URI=mongodb://localhost:27017 \
    JWT_SECRET_KEY=test \
    python -m unittest api.tests.test_complaint_workflow -v

They verify:
- initial status routing (normal / manual review / escalation)
- automatic agent assignment (persistence + activity + audit)
- no auto-assignment for manual-review complaints
- agents can only act on complaints assigned to them
- agent transitions persist status and activity records
- agents have no "Assigned" transition
- comments and resolutions persist
- reviewer state checks reject non-review complaints
- customer-visible vs internal activity separation
"""

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET_KEY", "test-only")

from bson import ObjectId
from fastapi import HTTPException

import api.activity as activity_module
import api.agent as agent_module
import api.assignment as assignment_module
import api.audit as audit_module
import api.review as review_module
from api.workflow import determine_initial_status


# ============================================================
# In-memory fake Mongo collection
# ============================================================

def _matches(document, query):
    for key, condition in query.items():
        value = document.get(key)

        if isinstance(condition, dict):
            if "$in" in condition:
                if value not in condition["$in"]:
                    return False
            if "$nin" in condition:
                if value in condition["$nin"]:
                    return False
        else:
            if value != condition:
                return False

    return True


class FakeInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class FakeCursor:
    def __init__(self, documents):
        self._documents = documents

    def sort(self, key, direction):
        return FakeCursor(sorted(
            self._documents,
            key=lambda d: d.get(key) or 0,
            reverse=(direction == -1),
        ))

    def __iter__(self):
        return iter(self._documents)

    def __len__(self):
        return len(self._documents)


class FakeCollection:
    def __init__(self):
        self.documents = []

    def insert_one(self, document):
        document = dict(document)
        document.setdefault("_id", ObjectId())
        self.documents.append(document)
        return FakeInsertResult(document["_id"])

    def find_one(self, query):
        for document in self.documents:
            if _matches(document, query):
                return document
        return None

    def find(self, query=None):
        query = query or {}
        return FakeCursor([
            d for d in self.documents if _matches(d, query)
        ])

    def count_documents(self, query):
        return len([
            d for d in self.documents if _matches(d, query)
        ])

    def update_one(self, query, update):
        for document in self.documents:
            if _matches(document, query):
                for key, value in update.get("$set", {}).items():
                    document[key] = value
                for key, value in update.get("$push", {}).items():
                    document.setdefault(key, []).append(value)
                return
        return


# ============================================================
# Base fixture
# ============================================================

class WorkflowTestCase(unittest.TestCase):
    def setUp(self):
        self.complaints = FakeCollection()
        self.users = FakeCollection()
        self.activity = FakeCollection()
        self.audit = FakeCollection()
        self.analyses = FakeCollection()

        self.patches = [
            patch.object(
                assignment_module, "complaints_collection",
                self.complaints),
            patch.object(
                assignment_module, "users_collection",
                self.users),
            patch.object(
                agent_module, "complaints_collection",
                self.complaints),
            patch.object(
                review_module, "complaints_collection",
                self.complaints),
            patch.object(
                review_module, "analyses_collection",
                self.analyses),
            patch.object(
                review_module, "users_collection",
                self.users),
            patch.object(
                activity_module,
                "complaint_activity_collection",
                self.activity),
            patch.object(
                audit_module, "audit_logs_collection",
                self.audit),
        ]

        for p in self.patches:
            p.start()

        self.addCleanup(
            lambda: [p.stop() for p in self.patches]
        )

        # Seed users
        self.agent_id = ObjectId()
        self.other_agent_id = ObjectId()

        self.users.insert_one({
            "_id": self.agent_id,
            "name": "Agent One",
            "role": "Agent",
            "status": "Active",
            "department": "Payments & Finance",
        })
        self.users.insert_one({
            "_id": self.other_agent_id,
            "name": "Agent Two",
            "role": "Agent",
            "status": "Active",
            "department": "Logistics",
        })

        self.agent_user = {
            "id": str(self.agent_id),
            "name": "Agent One",
            "role": "Agent",
        }
        self.other_agent_user = {
            "id": str(self.other_agent_id),
            "name": "Agent Two",
            "role": "Agent",
        }

    def _create_complaint(self, **overrides):
        document = {
            "title": "Duplicate charge",
            "description": "Charged twice for order NM-1",
            "user_id": "customer-1",
            "status": "Analyzed",
            "assigned_to": None,
            "assigned_department": "Payments & Finance",
            "manual_review_required": False,
            "review_status": None,
        }
        document.update(overrides)
        result = self.complaints.insert_one(document)
        return str(result.inserted_id)

    def _activity_titles(self, complaint_id):
        return [
            d["title"]
            for d in self.activity.documents
            if d["complaint_id"] == complaint_id
        ]


# ============================================================
# 1. Initial routing decision
# ============================================================

class InitialStatusTests(unittest.TestCase):
    def test_normal_complaint_is_analyzed(self):
        self.assertEqual(
            determine_initial_status({
                "manual_review_required": False,
                "escalation": {"required": False},
            }),
            "Analyzed",
        )

    def test_manual_review_complaint_routes_to_review(self):
        self.assertEqual(
            determine_initial_status({
                "manual_review_required": True,
            }),
            "Manual Review",
        )

    def test_escalation_detected_routes_to_escalated(self):
        self.assertEqual(
            determine_initial_status({
                "manual_review_required": False,
                "escalation": {"required": True},
            }),
            "Escalated",
        )


# ============================================================
# 2. Automatic assignment
# ============================================================

class AutoAssignmentTests(WorkflowTestCase):
    def test_normal_complaint_auto_assigned_to_department_agent(self):
        complaint_id = self._create_complaint()

        agent = assignment_module.auto_assign_complaint(
            complaint_object_id=ObjectId(complaint_id),
            complaint_id=complaint_id,
            department="Payments & Finance",
        )

        self.assertIsNotNone(agent)
        self.assertEqual(str(agent["_id"]), str(self.agent_id))

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertEqual(stored["status"], "Assigned")
        self.assertEqual(
            stored["assigned_to"], str(self.agent_id)
        )

        titles = self._activity_titles(complaint_id)
        self.assertIn(
            "Complaint automatically assigned to Agent",
            titles,
        )

        # Activity metadata carries the real agent, and the
        # audit trail records the system actor.
        entry = self.activity.find_one({
            "complaint_id": complaint_id,
            "type": "assigned",
        })
        self.assertEqual(
            entry["metadata"]["agent_id"], str(self.agent_id)
        )
        self.assertTrue(
            self.audit.find_one({
                "action": "Complaint automatically assigned",
            })
        )

    def test_least_loaded_agent_selected(self):
        # Load Agent One with an open complaint.
        self._create_complaint(
            assigned_to=str(self.agent_id),
            status="In Progress",
        )

        # Third agent in the same department with no load.
        free_agent_id = ObjectId()
        self.users.insert_one({
            "_id": free_agent_id,
            "name": "Agent Free",
            "role": "Agent",
            "status": "Active",
            "department": "Payments & Finance",
        })

        complaint_id = self._create_complaint()
        agent = assignment_module.auto_assign_complaint(
            complaint_object_id=ObjectId(complaint_id),
            complaint_id=complaint_id,
            department="Payments & Finance",
        )
        self.assertEqual(str(agent["_id"]), str(free_agent_id))

    def test_no_active_agent_leaves_unassigned(self):
        for user in self.users.documents:
            user["status"] = "Inactive"

        complaint_id = self._create_complaint()
        agent = assignment_module.auto_assign_complaint(
            complaint_object_id=ObjectId(complaint_id),
            complaint_id=complaint_id,
            department="Payments & Finance",
        )

        self.assertIsNone(agent)
        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertIsNone(stored["assigned_to"])
        self.assertIn(
            "Awaiting manual assignment",
            self._activity_titles(complaint_id),
        )

    def test_manual_review_complaint_cannot_be_assigned(self):
        complaint_id = self._create_complaint(
            manual_review_required=True,
            status="Manual Review",
            review_status="Pending",
        )

        with self.assertRaises(HTTPException) as ctx:
            assignment_module.assign_complaint(
                complaint_id=complaint_id,
                agent_id=str(self.agent_id),
                actor={
                    "id": "mgr-1",
                    "role": "Manager",
                    "name": "Manager",
                },
            )
        self.assertEqual(ctx.exception.status_code, 400)


# ============================================================
# 3. Agent workflow authority + persistence
# ============================================================

class AgentWorkflowTests(WorkflowTestCase):
    def test_agent_cannot_act_on_unassigned_complaint(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.other_agent_id),
            status="Assigned",
        )

        with self.assertRaises(HTTPException) as ctx:
            agent_module.start_handling(
                complaint_id=complaint_id,
                agent=self.agent_user,
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_agent_has_no_assigned_transition(self):
        # "Assigned" is produced by routing only. The agent
        # module must not expose any operation that sets it.
        import inspect

        source = inspect.getsource(agent_module)
        for line in source.splitlines():
            if 'next_status="Assigned"' in line.replace(" ", ""):
                self.fail(
                    "Agent module must not set Assigned status"
                )

    def test_start_sets_in_progress_and_persists_activity(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="Assigned",
        )

        result = agent_module.start_handling(
            complaint_id=complaint_id,
            agent=self.agent_user,
        )

        self.assertEqual(result["status"], "In Progress")
        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertEqual(stored["status"], "In Progress")

        entry = self.activity.find_one({
            "complaint_id": complaint_id,
            "type": "status",
        })
        self.assertIsNotNone(entry)
        self.assertEqual(entry["actor"], "Agent One")
        self.assertFalse(entry["customer_visible"])

    def test_await_customer_persists_message_and_visible_update(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="In Progress",
        )

        message = (
            "Please provide a photo of the damaged item."
        )
        agent_module.await_customer(
            complaint_id=complaint_id,
            agent=self.agent_user,
            comment=message,
        )

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertEqual(
            stored["status"], "Awaiting Customer"
        )
        self.assertEqual(
            stored["customer_facing_request"], message
        )

        visible = [
            d for d in self.activity.documents
            if d["complaint_id"] == complaint_id
            and d["customer_visible"]
        ]
        self.assertEqual(len(visible), 1)
        self.assertEqual(visible[0]["description"], message)

    def test_await_customer_requires_comment(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
        )
        with self.assertRaises(HTTPException) as ctx:
            agent_module.await_customer(
                complaint_id=complaint_id,
                agent=self.agent_user,
                comment="",
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_comment_persists_in_db_and_activity(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="In Progress",
        )

        agent_module.add_agent_comment(
            complaint_id=complaint_id,
            agent=self.agent_user,
            comment="Checked the transaction log.",
        )

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertEqual(len(stored["agent_comments"]), 1)
        self.assertEqual(
            stored["agent_comments"][0]["comment"],
            "Checked the transaction log.",
        )

        entry = self.activity.find_one({
            "complaint_id": complaint_id,
            "type": "note",
        })
        self.assertIsNotNone(entry)
        self.assertFalse(entry["customer_visible"])

    def test_escalate_persists_status_and_activity(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="In Progress",
        )

        agent_module.escalate_complaint(
            complaint_id=complaint_id,
            agent=self.agent_user,
            comment="Needs management approval.",
        )

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertEqual(stored["status"], "Escalated")
        entry = self.activity.find_one({
            "complaint_id": complaint_id,
            "type": "escalated",
        })
        self.assertIsNotNone(entry)
        self.assertIn(
            "Needs management approval.",
            entry["description"],
        )

    def test_resolve_persists_resolution_then_finalizes_closed(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="In Progress",
        )

        result = agent_module.resolve_complaint(
            complaint_id=complaint_id,
            agent=self.agent_user,
            comment="Refund issued for duplicate charge.",
        )

        # The final persisted lifecycle state is Closed —
        # complaints never sit permanently in Resolved.
        self.assertEqual(result["status"], "Closed")

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertEqual(stored["status"], "Closed")
        self.assertEqual(
            stored["resolution_comment"],
            "Refund issued for duplicate charge.",
        )
        self.assertIsNotNone(stored["resolved_at"])
        self.assertIsNotNone(stored["closed_at"])

        resolved = self.activity.find_one({
            "complaint_id": complaint_id,
            "type": "resolved",
        })
        self.assertTrue(resolved["customer_visible"])

        closed = self.activity.find_one({
            "complaint_id": complaint_id,
            "type": "closed",
        })
        self.assertIsNotNone(closed)
        self.assertTrue(closed["customer_visible"])


# ============================================================
# 3b. State-machine validation (duplicate / invalid actions)
# ============================================================

class StateValidationTests(WorkflowTestCase):
    def test_start_rejected_when_already_in_progress(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="In Progress",
        )

        with self.assertRaises(HTTPException) as ctx:
            agent_module.start_handling(
                complaint_id=complaint_id,
                agent=self.agent_user,
            )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_await_rejected_when_already_awaiting(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="Awaiting Customer",
        )

        with self.assertRaises(HTTPException) as ctx:
            agent_module.await_customer(
                complaint_id=complaint_id,
                agent=self.agent_user,
                comment="Again?",
            )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_resolve_rejected_on_closed_complaint(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="Closed",
        )

        with self.assertRaises(HTTPException) as ctx:
            agent_module.resolve_complaint(
                complaint_id=complaint_id,
                agent=self.agent_user,
                comment="Trying to resolve again.",
            )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_escalate_rejected_when_already_escalated(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="Escalated",
        )

        with self.assertRaises(HTTPException) as ctx:
            agent_module.escalate_complaint(
                complaint_id=complaint_id,
                agent=self.agent_user,
                comment="Escalate again.",
            )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_double_resolve_cannot_duplicate_activity(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="In Progress",
        )

        agent_module.resolve_complaint(
            complaint_id=complaint_id,
            agent=self.agent_user,
            comment="Refund issued.",
        )

        with self.assertRaises(HTTPException):
            agent_module.resolve_complaint(
                complaint_id=complaint_id,
                agent=self.agent_user,
                comment="Refund issued.",
            )

        resolved_events = [
            d for d in self.activity.documents
            if d["complaint_id"] == complaint_id
            and d["type"] == "resolved"
        ]
        self.assertEqual(len(resolved_events), 1)


# ============================================================
# 3c. Customer response (Awaiting Customer flow)
# ============================================================

class CustomerResponseTests(WorkflowTestCase):
    def setUp(self):
        super().setUp()
        self.customer_user = {
            "id": "customer-1",
            "name": "Customer One",
            "role": "Customer",
        }

    def test_customer_response_persists_and_returns_in_progress(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="Awaiting Customer",
            customer_facing_request="Send the receipt.",
        )

        result = agent_module.customer_respond(
            complaint_id=complaint_id,
            customer=self.customer_user,
            message="Receipt attached, order NM-1.",
        )

        self.assertEqual(result["status"], "In Progress")

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        # Status returns to In Progress and the assigned
        # agent is preserved.
        self.assertEqual(stored["status"], "In Progress")
        self.assertEqual(
            stored["assigned_to"], str(self.agent_id)
        )
        self.assertEqual(
            len(stored["customer_responses"]), 1
        )
        self.assertEqual(
            stored["customer_responses"][0]["message"],
            "Receipt attached, order NM-1.",
        )

        # The response is a customer-visible activity.
        entry = self.activity.find_one({
            "complaint_id": complaint_id,
            "title": "Customer responded",
        })
        self.assertIsNotNone(entry)
        self.assertTrue(entry["customer_visible"])
        self.assertEqual(entry["actor_role"], "Customer")

    def test_other_customer_cannot_respond(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="Awaiting Customer",
        )

        with self.assertRaises(HTTPException) as ctx:
            agent_module.customer_respond(
                complaint_id=complaint_id,
                customer={
                    "id": "customer-2",
                    "name": "Other Customer",
                    "role": "Customer",
                },
                message="I am not the owner.",
            )
        self.assertEqual(ctx.exception.status_code, 403)

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertEqual(stored["status"], "Awaiting Customer")

    def test_response_rejected_when_not_awaiting(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="In Progress",
        )

        with self.assertRaises(HTTPException) as ctx:
            agent_module.customer_respond(
                complaint_id=complaint_id,
                customer=self.customer_user,
                message="Here is more info.",
            )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_blank_response_rejected(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="Awaiting Customer",
        )

        with self.assertRaises(HTTPException) as ctx:
            agent_module.customer_respond(
                complaint_id=complaint_id,
                customer=self.customer_user,
                message="   ",
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_response_does_not_touch_analysis_or_assignment(self):
        complaint_id = self._create_complaint(
            assigned_to=str(self.agent_id),
            status="Awaiting Customer",
            assigned_department="Payments & Finance",
        )

        agent_module.customer_respond(
            complaint_id=complaint_id,
            customer=self.customer_user,
            message="Extra details.",
        )

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertEqual(
            stored["assigned_department"],
            "Payments & Finance",
        )
        self.assertEqual(
            stored["assigned_to"], str(self.agent_id)
        )


# ============================================================
# 3d. Post-review routing (Reviewer -> Agent handoff)
# ============================================================

class ReviewerRoutingTests(WorkflowTestCase):
    def setUp(self):
        super().setUp()
        self.reviewer = {
            "id": "reviewer-1",
            "name": "Reviewer One",
            "role": "Reviewer",
        }

    def _create_review_complaint(self, **overrides):
        complaint_id = self._create_complaint(
            manual_review_required=True,
            review_status="Pending",
            status="Manual Review",
            **overrides,
        )
        self.analyses.insert_one({
            "complaint_id": complaint_id,
            "analysis": {
                "classification": {
                    "category": "Billing",
                    "department": "Payments & Finance",
                },
            },
        })
        return complaint_id

    def test_approved_complaint_enters_agent_workflow(self):
        complaint_id = self._create_review_complaint()

        result = review_module.approve_review(
            complaint_id=complaint_id,
            reviewer=self.reviewer,
            comment="Classification is correct.",
        )

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )

        # Review is complete: leaves the reviewer queue
        # population and is auto-assigned to an agent.
        self.assertEqual(stored["review_status"], "Completed")
        self.assertFalse(stored["manual_review_required"])
        self.assertEqual(stored["status"], "Assigned")
        self.assertEqual(
            stored["assigned_to"], str(self.agent_id)
        )
        self.assertEqual(result["status"], "Assigned")
        self.assertEqual(
            result["assigned_agent"]["id"],
            str(self.agent_id),
        )

        self.assertIn(
            "Complaint automatically assigned to Agent",
            self._activity_titles(complaint_id),
        )

    def test_approved_complaint_without_agents_stays_analyzed(self):
        for user in self.users.documents:
            user["status"] = "Inactive"

        complaint_id = self._create_review_complaint()

        result = review_module.approve_review(
            complaint_id=complaint_id,
            reviewer=self.reviewer,
            comment="Approved.",
        )

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertEqual(stored["status"], "Analyzed")
        self.assertIsNone(stored["assigned_to"])
        self.assertIsNone(result["assigned_agent"])
        self.assertIn(
            "Awaiting manual assignment",
            self._activity_titles(complaint_id),
        )

    def test_escalated_review_stays_escalated_and_unassigned(self):
        complaint_id = self._create_review_complaint()

        review_module.escalate_review(
            complaint_id=complaint_id,
            reviewer=self.reviewer,
            comment="Sensitive case.",
        )

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertEqual(stored["status"], "Escalated")
        self.assertIsNone(stored["assigned_to"])
        self.assertNotIn(
            "Complaint automatically assigned to Agent",
            self._activity_titles(complaint_id),
        )

    def test_rejected_review_escalates_without_assignment(self):
        complaint_id = self._create_review_complaint()

        review_module.reject_review(
            complaint_id=complaint_id,
            reviewer=self.reviewer,
            comment="Analysis unusable.",
        )

        stored = self.complaints.find_one(
            {"_id": ObjectId(complaint_id)}
        )
        self.assertEqual(stored["status"], "Escalated")
        self.assertIsNone(stored["assigned_to"])

    def test_completed_review_leaves_reviewer_queue_population(self):
        complaint_id = self._create_review_complaint()

        review_module.approve_review(
            complaint_id=complaint_id,
            reviewer=self.reviewer,
            comment="Done.",
        )

        # The reviewer queue query is:
        # {manual_review_required: True, review_status: "Pending"}
        still_pending = self.complaints.find_one({
            "_id": ObjectId(complaint_id),
            "manual_review_required": True,
            "review_status": "Pending",
        })
        self.assertIsNone(still_pending)


# ============================================================
# 4. Reviewer state checks
# ============================================================

class ReviewerStateTests(WorkflowTestCase):
    def test_reviewer_rejected_on_normal_complaint(self):
        # A complaint that is NOT in the manual-review
        # population must be rejected by reviewer actions.
        complaint = self.complaints.find_one({
            "_id": ObjectId(self._create_complaint())
        })

        with self.assertRaises(HTTPException) as ctx:
            review_module._require_pending_review(complaint)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_reviewer_allowed_on_pending_review_complaint(self):
        complaint = self.complaints.find_one({
            "_id": ObjectId(self._create_complaint(
                manual_review_required=True,
                review_status="Pending",
                status="Manual Review",
            ))
        })

        # Must not raise.
        review_module._require_pending_review(complaint)


# ============================================================
# 5. Activity records
# ============================================================

class ActivityTests(WorkflowTestCase):
    def test_activity_is_persisted_with_required_fields(self):
        activity_module.create_complaint_activity(
            complaint_id="c-1",
            activity_type="status",
            title="Test event",
            description="details",
            actor="Agent One",
            actor_role="Agent",
            metadata={"k": "v"},
        )

        entry = self.activity.find_one({"complaint_id": "c-1"})
        self.assertEqual(entry["type"], "status")
        self.assertEqual(entry["title"], "Test event")
        self.assertEqual(entry["actor"], "Agent One")
        self.assertEqual(entry["actor_role"], "Agent")
        self.assertEqual(entry["metadata"], {"k": "v"})
        self.assertFalse(entry["customer_visible"])
        self.assertIsNotNone(entry["timestamp"])

    def test_customer_visibility_flag_separates_events(self):
        activity_module.create_complaint_activity(
            complaint_id="c-2",
            activity_type="note",
            title="Internal note",
        )
        activity_module.create_complaint_activity(
            complaint_id="c-2",
            activity_type="comment",
            title="Customer update",
            customer_visible=True,
        )

        visible = [
            d for d in self.activity.documents
            if d["complaint_id"] == "c-2"
            and d["customer_visible"]
        ]
        self.assertEqual(len(visible), 1)
        self.assertEqual(visible[0]["title"], "Customer update")


if __name__ == "__main__":
    unittest.main()
