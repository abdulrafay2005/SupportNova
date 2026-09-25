import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Paperclip } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAuth } from "@/auth/AuthContext";
import { useData } from "@/context/DataContext";

const CHANNELS = [
  { value: "Portal", label: "Portal" },
  { value: "Email", label: "Email" },
  { value: "Phone", label: "Phone" },
];

const TYPES = [
  { value: "Consumer", label: "Consumer" },
  { value: "Business", label: "Business" },
];

export function NewComplaint() {
  const { user } = useAuth();
  const { addComplaint } = useData();
  const navigate = useNavigate();
  const isStaff = user?.role === "Agent" || user?.role === "Admin";
  const needsContact = isStaff || !user;

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [productService, setProductService] = useState("");
  const [reference, setReference] = useState("");
  const [customerType, setCustomerType] = useState("Consumer");
  const [previousId, setPreviousId] = useState("");
  const [channel, setChannel] = useState("Portal");
  const [attachmentName, setAttachmentName] = useState("");
  const [customerName, setCustomerName] = useState(user && !isStaff ? user.name : "");
  const [customerEmail, setCustomerEmail] = useState(user && !isStaff ? user.email : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdId, setCreatedId] = useState<string | null>(null);

 const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (subject.trim().length < 4) next.subject = "Enter a short title (at least 4 characters).";
    if (description.trim().length < 20) next.description = "Describe the issue in at least 20 characters.";
    if (attachmentName && !/\.(pdf|png|jpe?g|docx?)$/i.test(attachmentName)) {
      next.attachment = "Unsupported attachment. Use PDF, DOCX, PNG or JPEG.";
    }
    if (needsContact) {
      if (customerName.trim().length < 2) next.customerName = "Name is required.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) next.customerEmail = "Enter a valid email.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
  const created = await addComplaint({
  subject,
  description,
  productService,
  reference,
  customerType,
  previousComplaintId: previousId,
  contactChannel: channel,
  attachmentName: attachmentName || undefined,
  customerName: needsContact ? customerName : user?.name,
  customerEmail: needsContact ? customerEmail : user?.email,
});

setCreatedId(created.id);
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
            <Button variant="outline" onClick={() => { setCreatedId(null); setSubject(""); setDescription(""); setReference(""); setAttachmentName(""); setProductService(""); setPreviousId(""); }}>
              Submit another complaint
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const backTo = isStaff ? "/complaints" : user ? "/my-complaints" : "/";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        breadcrumb={<Breadcrumbs items={[{ label: isStaff ? "Complaints" : "Home", to: backTo }, { label: "New" }]} />}
        title={isStaff ? "Log a complaint" : "Submit a complaint"}
        description="Please provide as much detail as possible so our support team can investigate your issue."
      />

      <form onSubmit={onSubmit} className="space-y-4">
        {needsContact && (
          <section className="panel p-4">
            <h2 className="text-[13px] font-semibold text-ink">Contact information</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input label="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} error={errors.customerName} />
              <Input label="Email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} error={errors.customerEmail} />
            </div>
          </section>
        )}

        <section className="panel p-4">
          <h2 className="text-[13px] font-semibold text-ink">Complaint information</h2>
          <p className="mb-3 text-[12px] text-ink-muted">
            A clear title and a specific description help the support team investigate.
          </p>
          <div className="space-y-3">
            <Input label="Title" value={subject} onChange={(e) => setSubject(e.target.value)} error={errors.subject} placeholder="e.g. Damaged parcel" />
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
              hint="Include what happened, when, and what you would like us to do."
              placeholder="My order arrived damaged and I want a replacement."
              rows={7}
            />
            <Input label="Product / service" value={productService} onChange={(e) => setProductService(e.target.value)} placeholder="Optional" />
            <Input label="Order / reference number" value={reference} onChange={(e) => setReference(e.target.value)} hint="Optional, but speeds up investigation." placeholder="ORD-88421" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Customer type" options={TYPES} value={customerType} onChange={(e) => setCustomerType(e.target.value)} />
              <Select label="Preferred contact channel" options={CHANNELS} value={channel} onChange={(e) => setChannel(e.target.value)} />
            </div>
            <Input label="Previous complaint reference" value={previousId} onChange={(e) => setPreviousId(e.target.value)} placeholder="SN-000124" hint="If this relates to an earlier complaint." />
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-secondary">Supporting information</span>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line-strong bg-canvas-subtle px-3 py-3 text-[13px] hover:border-primary">
                <Paperclip size={16} className="text-ink-muted" />
                <span className="text-ink-secondary">
                  {attachmentName ? attachmentName : "Optional attachment — PDF, DOCX, PNG or JPEG (not uploaded in this demo)"}
                </span>
                <input
                  type="file"
                  className="sr-only"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? "")}
                />
              </label>
              {errors.attachment && <span className="mt-1 block text-xs text-danger">{errors.attachment}</span>}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to={backTo} className="text-[13px] text-ink-muted hover:text-ink">
            Cancel
          </Link>
          <Button type="submit">Submit complaint</Button>
        </div>
      </form>
    </div>
  );
}
