import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { Textarea } from "@/components/Textarea";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useData } from "@/context/DataContext";

/**
 * Submit a complaint.
 *
 * The route is Customer-only (see App.tsx) and POST /api/complaints
 * stores exactly four fields: title, description, order_id and
 * product. Nothing else is collected here, because any extra input
 * would be silently discarded by the API and would then disappear
 * from the complaint the moment the page is reloaded.
 */
export function NewComplaint() {
  const { addComplaint } = useData();
  const navigate = useNavigate();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [productService, setProductService] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const next: Record<string, string> = {};

    if (subject.trim().length < 4) {
      next.subject = "Enter a short title (at least 4 characters).";
    }

    if (description.trim().length < 20) {
      next.description = "Describe the issue in at least 20 characters.";
    }

    setErrors(next);

    if (Object.keys(next).length) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const created = await addComplaint({
        subject,
        description,
        productService,
        reference,
      });

      setCreatedId(created.id);
    } catch (error) {
      /*
       * The submission failed on the server. Say so instead of
       * leaving the form looking as though nothing happened.
       */
      const detail =
        typeof error === "object" &&
        error !== null &&
        "response" in error
          ? (
              error as {
                response?: { data?: { detail?: unknown } };
              }
            ).response?.data?.detail
          : undefined;

      setSubmitError(
        typeof detail === "string"
          ? detail
          : error instanceof Error
            ? error.message
            : "Your complaint could not be submitted. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (createdId) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="panel px-6 py-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-success-subtle text-success">
            <CheckCircle2 size={20} />
          </div>
          <h1 className="text-lg font-semibold text-ink">Complaint submitted successfully</h1>
          <p className="mt-3 text-[13px] text-ink-muted">Complaint ID</p>
          <p className="font-mono text-base font-semibold text-ink">{createdId}</p>
          <p className="mx-auto mt-3 max-w-md text-[13px] text-ink-secondary">
            Your complaint has been received and will be analyzed and routed to the appropriate department. Keep this ID to track progress.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => navigate(`/complaints/${createdId}`)}>View complaint</Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreatedId(null);
                setSubject("");
                setDescription("");
                setReference("");
                setProductService("");
                setSubmitError(null);
              }}
            >
              Submit another complaint
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        breadcrumb={<Breadcrumbs items={[{ label: "Home", to: "/my-complaints" }, { label: "New" }]} />}
        title="Submit a complaint"
        description="Please provide as much detail as possible so our support team can investigate your issue."
      />

      <form onSubmit={onSubmit} className="space-y-4">
        <section className="panel p-4">
          <h2 className="text-[13px] font-semibold text-ink">Complaint information</h2>
          <p className="mb-3 text-[12px] text-ink-muted">
            A clear title and a specific description help the support team investigate.
          </p>
          <div className="space-y-3">
            <Input
              label="Title"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              error={errors.subject}
              placeholder="e.g. Damaged parcel"
            />
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
              hint="Include what happened, when, and what you would like us to do."
              placeholder="My order arrived damaged and I want a replacement."
              rows={7}
            />
            <Input
              label="Product / service"
              value={productService}
              onChange={(e) => setProductService(e.target.value)}
              placeholder="Optional"
            />
            <Input
              label="Order / reference number"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              hint="Optional, but speeds up investigation."
              placeholder="ORD-88421"
            />

            <p className="rounded-md border border-dashed border-line-strong bg-canvas-subtle px-3 py-3 text-[13px] text-ink-secondary">
              File attachments are not supported yet. Please include order
              numbers, dates, amounts and any earlier complaint reference in
              the description above so they are recorded with the complaint.
            </p>
          </div>
        </section>

        {submitError && (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
            {submitError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to="/my-complaints" className="text-[13px] text-ink-muted hover:text-ink">
            Cancel
          </Link>
          <Button type="submit" loading={submitting} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit complaint"}
          </Button>
        </div>
      </form>
    </div>
  );
}
