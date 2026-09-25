import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/Button";
import { ComplaintTable } from "@/components/ComplaintTable";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchBar } from "@/components/SearchBar";
import { Select } from "@/components/Select";
import { useData } from "@/context/DataContext";
import { categories, departments } from "@/data/mockData";
import {
  COMPLAINT_STATUSES,
  PRIORITIES,
  SENTIMENTS,
  URGENCIES,
  type Complaint,
  type Priority,
} from "@/types";

const PAGE_SIZE = 10;
type SortKey = "updated" | "priority" | "status" | "id";
const priorityRank: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function Complaints() {
  const { complaints, customers } = useData();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [department, setDepartment] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [urgency, setUrgency] = useState("");
  const [escalation, setEscalation] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    let list = complaints.filter((c) => {
      const customer = customers.find((x) => x.id === c.customerId);
      const hay = `${c.id} ${c.subject} ${c.description} ${c.category} ${customer?.name ?? ""} ${c.reference ?? ""}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (status && c.status !== status) return false;
      if (priority && c.priority !== priority) return false;
      if (category && c.category !== category) return false;
      if (department && c.department !== department) return false;
      if (sentiment && c.sentiment !== sentiment) return false;
      if (urgency && c.urgency !== urgency) return false;
      if (escalation === "yes" && !c.escalated) return false;
      if (escalation === "no" && c.escalated) return false;
      if (dateRange === "today" && new Date(c.createdAt).toDateString() !== new Date().toDateString()) return false;
      if (dateRange === "7" && now - new Date(c.createdAt).getTime() > 7 * 86400000) return false;
      if (dateRange === "30" && now - new Date(c.createdAt).getTime() > 30 * 86400000) return false;
      return true;
    });
    list = [...list].sort((a, b) => compare(a, b, sort));
    return list;
  }, [complaints, customers, query, status, priority, category, department, sentiment, urgency, escalation, dateRange, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasFilters = Boolean(query || status || priority || category || department || sentiment || urgency || escalation || dateRange);

  const clear = () => {
    setQuery("");
    setStatus("");
    setPriority("");
    setCategory("");
    setDepartment("");
    setSentiment("");
    setUrgency("");
    setEscalation("");
    setDateRange("");
    setPage(1);
    setParams({});
  };

  const bump = () => setSort((s) => (s === "updated" ? "priority" : s === "priority" ? "status" : s === "status" ? "id" : "updated"));

  return (
    <div>
      <PageHeader
        title="Complaints"
        description="Search and filter the workspace. Demo records only."
        actions={
          <Link to="/complaints/new">
            <Button>New complaint</Button>
          </Link>
        }
      />
      <div className="panel mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SearchBar value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Search ID, customer, subject..." className="sm:col-span-2" />
          <Select options={COMPLAINT_STATUSES.map((s) => ({ value: s, label: s }))} placeholder="All statuses" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
          <Select options={PRIORITIES.map((s) => ({ value: s, label: s }))} placeholder="All priorities" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} />
          <Select options={categories.map((s) => ({ value: s, label: s }))} placeholder="All categories" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} />
          <Select options={departments.map((s) => ({ value: s, label: s }))} placeholder="All departments" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} />
          <Select options={SENTIMENTS.map((s) => ({ value: s, label: s }))} placeholder="All sentiment" value={sentiment} onChange={(e) => { setSentiment(e.target.value); setPage(1); }} />
          <Select options={URGENCIES.map((s) => ({ value: s, label: s }))} placeholder="All urgency" value={urgency} onChange={(e) => { setUrgency(e.target.value); setPage(1); }} />
          <Select options={[{ value: "yes", label: "Escalated" }, { value: "no", label: "Not escalated" }]} placeholder="Escalation" value={escalation} onChange={(e) => { setEscalation(e.target.value); setPage(1); }} />
          <Select options={[{ value: "today", label: "Today" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }]} placeholder="Any date" value={dateRange} onChange={(e) => { setDateRange(e.target.value); setPage(1); }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink" onClick={bump}>
            <ArrowUpDown size={12} />
            Sort: {sort === "updated" ? "Updated" : sort === "id" ? "Complaint ID" : sort === "priority" ? "Priority" : "Status"}
          </button>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear filters
            </Button>
          )}
        </div>
      </div>
      <p className="mb-2 text-[12px] text-ink-muted tabular">{filtered.length} complaints</p>
      <ComplaintTable complaints={slice} customers={customers} onClearFilters={hasFilters ? clear : undefined} />
      <div className="mt-3">
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </div>
    </div>
  );
}

function compare(a: Complaint, b: Complaint, sort: SortKey) {
  if (sort === "priority") return priorityRank[a.priority] - priorityRank[b.priority];
  if (sort === "status") return a.status.localeCompare(b.status);
  if (sort === "id") return b.id.localeCompare(a.id);
  return +new Date(b.updatedAt) - +new Date(a.updatedAt);
}
