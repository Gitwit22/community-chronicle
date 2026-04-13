import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { OrgProvider } from "@/context/OrgContext";
import { OrgAdminRoute } from "@/components/OrgAdminRoute";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Landing from "./pages/Landing.tsx";
import Login from "./pages/Login.tsx";
import OrgSetup from "./pages/OrgSetup.tsx";
import NotFound from "./pages/NotFound.tsx";
import { OrgPortal } from "./pages/OrgPortal.tsx";
import { OrgSettingsLayout } from "./pages/OrgSettingsLayout.tsx";
import { OrgProfileSettings } from "./pages/OrgProfileSettings.tsx";
import { OrgUsersSettings } from "./pages/OrgUsersSettings.tsx";
import { OrgRolesSettings } from "./pages/OrgRolesSettings.tsx";
import { OrgProgramAccessSettings } from "./pages/OrgProgramAccessSettings.tsx";
import { OrgInvitationsSettings } from "./pages/OrgInvitationsSettings.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrgProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/landing" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/org-setup" element={<OrgSetup />} />
              <Route path="/setup" element={<Navigate to="/org-setup" replace />} />

              {/* Organization portal — /org/:slug */}
              <Route path="/org/:slug" element={<OrgPortal />} />

              {/* Organization settings — /org/:slug/settings/* (org admin only) */}
              <Route
                path="/org/:slug/settings"
                element={<Navigate to="profile" replace />}
              />
              <Route
                path="/org/:slug/settings/profile"
                element={
                  <OrgAdminRoute>
                    <OrgSettingsLayout>
                      <OrgProfileSettings />
                    </OrgSettingsLayout>
                  </OrgAdminRoute>
                }
              />
              <Route
                path="/org/:slug/settings/users"
                element={
                  <OrgAdminRoute>
                    <OrgSettingsLayout>
                      <OrgUsersSettings />
                    </OrgSettingsLayout>
                  </OrgAdminRoute>
                }
              />
              <Route
                path="/org/:slug/settings/roles"
                element={
                  <OrgAdminRoute>
                    <OrgSettingsLayout>
                      <OrgRolesSettings />
                    </OrgSettingsLayout>
                  </OrgAdminRoute>
                }
              />
              <Route
                path="/org/:slug/settings/programs"
                element={
                  <OrgAdminRoute>
                    <OrgSettingsLayout>
                      <OrgProgramAccessSettings />
                    </OrgSettingsLayout>
                  </OrgAdminRoute>
                }
              />
              <Route
                path="/org/:slug/settings/invitations"
                element={
                  <OrgAdminRoute>
                    <OrgSettingsLayout>
                      <OrgInvitationsSettings />
                    </OrgSettingsLayout>
                  </OrgAdminRoute>
                }
              />

              {/* Main archive app — protected, requires valid Chronicle session */}
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              {/* Redirect old entry-point hits */}
              <Route path="/index" element={<Navigate to="/" replace />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

