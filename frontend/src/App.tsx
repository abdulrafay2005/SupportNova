import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";

import { AuthProvider, useAuth } from "@/auth/AuthContext";
import {
  ProtectedRoute,
  RoleRoute,
} from "@/auth/ProtectedRoute";

import { AppLayout } from "@/components/AppLayout";
import { PublicLayout } from "@/components/PublicLayout";

import { DataProvider } from "@/context/DataContext";

import { Analytics } from "@/pages/Analytics";
import { ArticleDetail } from "@/pages/ArticleDetail";
import { AuditLogs } from "@/pages/AuditLogs";
import { ComplaintDetail } from "@/pages/ComplaintDetail";
import { Complaints } from "@/pages/Complaints";
import { Dashboard } from "@/pages/Dashboard";
import { DepartmentsAdmin } from "@/pages/DepartmentsAdmin";
import { Documents } from "@/pages/Documents";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { Home } from "@/pages/Home";
import { HowItWorks } from "@/pages/HowItWorks";
import { About } from "@/pages/About";
import { Contact } from "@/pages/Contact";
import { Track } from "@/pages/Track";
import { Legal } from "@/pages/Legal";
import { HelpCenter } from "@/pages/HelpCenter";
import { Login } from "@/pages/Login";
import { ManualReview } from "@/pages/ManualReview";
import { MyComplaints } from "@/pages/MyComplaints";
import { MyQueue } from "@/pages/MyQueue";
import { NewComplaint } from "@/pages/NewComplaint";
import { NotFound } from "@/pages/NotFound";
import { Profile } from "@/pages/Profile";
import { Register } from "@/pages/Register";
import { Reports } from "@/pages/Reports";
import { RulesAdmin } from "@/pages/RulesAdmin";
import { Settings } from "@/pages/Settings";
import { UsersAdmin } from "@/pages/UsersAdmin";

function AdaptiveLayout() {
  const { user } = useAuth();

  return user ? <AppLayout /> : <PublicLayout />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <DataProvider>
          <Routes>
            {/* =========================
                PUBLIC ROUTES
            ========================== */}

            <Route path="/" element={<Home />} />

            <Route
              path="/how-it-works"
              element={<HowItWorks />}
            />

            <Route path="/about" element={<About />} />

            <Route path="/contact" element={<Contact />} />

            <Route path="/track" element={<Track />} />

            <Route
              path="/privacy"
              element={<Legal kind="privacy" />}
            />

            <Route
              path="/terms"
              element={<Legal kind="terms" />}
            />

            <Route path="/login" element={<Login />} />

            <Route
              path="/register"
              element={<Register />}
            />

            <Route
              path="/forgot-password"
              element={<ForgotPassword />}
            />

            {/* =========================
                PUBLIC / AUTH-AWARE HELP
            ========================== */}

            <Route element={<AdaptiveLayout />}>
              <Route
                path="/help-center"
                element={<HelpCenter />}
              />

              <Route
                path="/help-center/:id"
                element={<ArticleDetail />}
              />

              <Route
                path="/knowledge"
                element={
                  <Navigate
                    to="/help-center"
                    replace
                  />
                }
              />

              <Route
                path="/knowledge/:id"
                element={<KnowledgeRedirect />}
              />
            </Route>

            {/* =========================
                PROTECTED APPLICATION
            ========================== */}

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>

                {/* =====================
                    SHARED AUTHENTICATED
                ====================== */}

                <Route
                  path="/dashboard"
                  element={<Dashboard />}
                />

                <Route
                  path="/profile"
                  element={<Profile />}
                />

                <Route
                  path="/settings"
                  element={<Settings />}
                />

                <Route
                    path="/complaints/:id"
                    element={<ComplaintDetail />}
                />

                {/* =====================
                    CUSTOMER
                ====================== */}

                <Route
                  element={
                    <RoleRoute roles={["Customer"]} />
                  }
                >
                  <Route
                    path="/my-complaints"
                    element={<MyComplaints />}
                  />

                  <Route
                    path="/complaints/new"
                    element={<NewComplaint />}
                  />
                </Route>

                {/* =====================
                    STAFF (shared)

                    NOTE: each path must be
                    defined exactly once.
                    Duplicate sibling routes
                    (e.g. /complaints under
                    separate single-role
                    RoleRoutes) only match the
                    first definition, which
                    redirected every other
                    role back to /dashboard.
                ====================== */}

                <Route
                  element={
                    <RoleRoute
                      roles={[
                        "Agent",
                        "Reviewer",
                        "Manager",
                        "Admin",
                      ]}
                    />
                  }
                >
                  <Route
                    path="/complaints"
                    element={<Complaints />}
                  />
                </Route>

                {/* =====================
                    AGENT
                ====================== */}

                <Route
                  element={
                    <RoleRoute roles={["Agent"]} />
                  }
                >
                  <Route
                    path="/queue"
                    element={<MyQueue />}
                  />
                </Route>

                {/* =====================
                    REVIEWER
                ====================== */}

                <Route
                  element={
                    <RoleRoute roles={["Reviewer"]} />
                  }
                >
                  <Route
                    path="/manual-review"
                    element={<ManualReview />}
                  />
                </Route>

                {/* =====================
                    MANAGER + ADMIN
                ====================== */}

                <Route
                  element={
                    <RoleRoute
                      roles={["Manager", "Admin"]}
                    />
                  }
                >
                  <Route
                    path="/analytics"
                    element={<Analytics />}
                  />

                  <Route
                    path="/reports"
                    element={<Reports />}
                  />
                </Route>

                {/* =====================
                    ADMIN
                ====================== */}

                <Route
                  element={
                    <RoleRoute roles={["Admin"]} />
                  }
                >
                  <Route
                    path="/users"
                    element={<UsersAdmin />}
                  />

                  <Route
                    path="/departments"
                    element={<DepartmentsAdmin />}
                  />

                  <Route
                    path="/rules"
                    element={<RulesAdmin />}
                  />

                  <Route
                    path="/documents"
                    element={<Documents />}
                  />

                  <Route
                    path="/audit-logs"
                    element={<AuditLogs />}
                  />

                  <Route
                    path="/admin/users"
                    element={
                      <Navigate
                        to="/users"
                        replace
                      />
                    }
                  />

                  <Route
                    path="/admin/rules"
                    element={
                      <Navigate
                        to="/rules"
                        replace
                      />
                    }
                  />

                  <Route
                    path="/admin/audit"
                    element={
                      <Navigate
                        to="/audit-logs"
                        replace
                      />
                    }
                  />
                </Route>

                {/* =====================
                    APPLICATION 404
                ====================== */}

                <Route
                  path="*"
                  element={<NotFound />}
                />
              </Route>
            </Route>

            {/* =========================
                GLOBAL 404
            ========================== */}

            <Route
              path="*"
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />
          </Routes>
        </DataProvider>
      </AuthProvider>
    </HashRouter>
  );
}

function KnowledgeRedirect() {
  const { id } = useParams();

  return (
    <Navigate
      to={`/help-center/${id ?? ""}`}
      replace
    />
  );
}