import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GlobalPrefetch } from "@/components/GlobalPrefetch";
import AdminAuth from "./pages/AdminAuth";
import Setup from "./pages/Setup";
import Home from "./pages/Home";
import RegisterItem from "./pages/RegisterItem";
import ItemsList from "./pages/ItemsList";
import ArchivedItemsList from "./pages/ArchivedItemsList";
import ItemDetail from "./pages/ItemDetail";
import History from "./pages/History";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import DashboardStats from "./pages/DashboardStats";
import NotFound from "./pages/NotFound";
import Permissions from "./pages/Permissions";
import ActivityHistory from "./pages/ActivityHistory";
import ChangePassword from "./pages/ChangePassword";

// Equipment Module
import EquipmentList from "./pages/equipment/EquipmentList";
import EquipmentRegister from "./pages/equipment/EquipmentRegister";
import EquipmentLoans from "./pages/equipment/EquipmentLoans";
import EquipmentLoanForm from "./pages/equipment/EquipmentLoanForm";
import EquipmentReservations from "./pages/equipment/EquipmentReservations";

// Lockers Module
import LockersList from "./pages/lockers/LockersList";
import LockerLoanForm from "./pages/lockers/LockerLoanForm";
import LockerLoans from "./pages/lockers/LockerLoans";

// Rooms Module
import RoomsList from "./pages/rooms/RoomsList";
import ChecklistForm from "./pages/rooms/ChecklistForm";
import ChecklistHistory from "./pages/rooms/ChecklistHistory";
import ShiftHandoverForm from "./pages/rooms/ShiftHandoverForm";
import ShiftHandoverHistory from "./pages/rooms/ShiftHandoverHistory";

// Materials Module
import MaterialRequestsList from "./pages/materials/MaterialRequestsList";
import MaterialRequestForm from "./pages/materials/MaterialRequestForm";
import MyMaterialRequests from "./pages/materials/MyMaterialRequests";

// Classroom Calls Module
import ClassroomCallForm from "./pages/classroom/ClassroomCallForm";
import ClassroomCallsList from "./pages/classroom/ClassroomCallsList";
import ClassroomCallSettings from "./pages/classroom/ClassroomCallSettings";

// Tasks Module
import TasksList from "./pages/tasks/TasksList";
import MyTasks from "./pages/tasks/MyTasks";
import TasksDashboard from "./pages/tasks/TasksDashboard";

// Room Reservations Module
import RoomReservationsList from "./pages/reservations/RoomReservationsList";
import NewReservationForm from "./pages/reservations/NewReservationForm";
import ReservationRoomsManagement from "./pages/reservations/ReservationRoomsManagement";
import PublicReservationBoard from "./pages/reservations/PublicReservationBoard";

// Labels Module
import LabelTemplatesList from "./pages/labels/LabelTemplatesList";
import LabelTemplateEditor from "./pages/labels/LabelTemplateEditor";
import LabelGenerate from "./pages/labels/LabelGenerate";

// Portal do Cliente (external)
import PortalLayout from "./pages/portal-cliente/PortalLayout";
import PortalLogin from "./pages/portal-cliente/PortalLogin";
import PortalSignup from "./pages/portal-cliente/PortalSignup";
import PortalDashboard from "./pages/portal-cliente/PortalDashboard";
import PortalNewReservation from "./pages/portal-cliente/PortalNewReservation";
import PortalMyReservations from "./pages/portal-cliente/PortalMyReservations";
import ExternalUsersApproval from "./pages/ExternalUsersApproval";

// PWA
import Install from "./pages/Install";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <GlobalPrefetch />
        <BrowserRouter>
          <AuthProvider>
            <OfflineProvider>
              <Routes>
              {/* Public Routes */}
              <Route path="/admin-auth" element={<AdminAuth />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/change-password" element={<ChangePassword />} />
              
              {/* Protected Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <DashboardStats />
                </ProtectedRoute>
              } />
              
              {/* Lost and Found Module */}
              <Route path="/lost-found" element={
                <ProtectedRoute>
                  <ItemsList />
                </ProtectedRoute>
              } />
              <Route path="/lost-found/register" element={
                <ProtectedRoute>
                  <RegisterItem />
                </ProtectedRoute>
              } />
              <Route path="/lost-found/items" element={
                <ProtectedRoute>
                  <ItemsList />
                </ProtectedRoute>
              } />
              <Route path="/lost-found/items/:id" element={
                <ProtectedRoute>
                  <ItemDetail />
                </ProtectedRoute>
              } />
              <Route path="/lost-found/history" element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              } />
              <Route path="/lost-found/archived" element={
                <ProtectedRoute>
                  <ArchivedItemsList />
                </ProtectedRoute>
              } />
              
              {/* Equipment Module */}
              <Route path="/equipment" element={
                <ProtectedRoute>
                  <EquipmentList />
                </ProtectedRoute>
              } />
              <Route path="/equipment/register" element={
                <ProtectedRoute>
                  <EquipmentRegister />
                </ProtectedRoute>
              } />
              <Route path="/equipment/loans" element={
                <ProtectedRoute>
                  <EquipmentLoans />
                </ProtectedRoute>
              } />
              <Route path="/equipment/loan/new" element={
                <ProtectedRoute>
                  <EquipmentLoanForm />
                </ProtectedRoute>
              } />
              <Route path="/equipment/edit/:id" element={
                <ProtectedRoute>
                  <EquipmentRegister />
                </ProtectedRoute>
              } />
              <Route path="/equipment/reservations" element={
                <ProtectedRoute>
                  <EquipmentReservations />
                </ProtectedRoute>
              } />
              {/* Legacy route - redirect to main equipment page */}
              <Route path="/equipment/inventory" element={<Navigate to="/equipment" replace />} />
              
              {/* Rooms Module */}
              <Route path="/rooms" element={
                <ProtectedRoute>
                  <RoomsList />
                </ProtectedRoute>
              } />
              <Route path="/rooms/checklist/new" element={
                <ProtectedRoute>
                  <ChecklistForm />
                </ProtectedRoute>
              } />
              <Route path="/rooms/checklists" element={
                <ProtectedRoute>
                  <ChecklistHistory />
                </ProtectedRoute>
              } />
              <Route path="/rooms/shift-handover/new" element={
                <ProtectedRoute>
                  <ShiftHandoverForm />
                </ProtectedRoute>
              } />
              <Route path="/rooms/shift-handovers" element={
                <ProtectedRoute>
                  <ShiftHandoverHistory />
                </ProtectedRoute>
              } />
              
              {/* Lockers Module */}
              <Route path="/lockers" element={
                <ProtectedRoute>
                  <LockersList />
                </ProtectedRoute>
              } />
              <Route path="/lockers/loan/new" element={
                <ProtectedRoute>
                  <LockerLoanForm />
                </ProtectedRoute>
              } />
              <Route path="/lockers/loans" element={
                <ProtectedRoute>
                  <LockerLoans />
                </ProtectedRoute>
              } />
              <Route path="/lockers/allocations" element={
                <ProtectedRoute>
                  <LockerLoans />
                </ProtectedRoute>
              } />
              
              {/* Materials Module */}
              <Route path="/materials" element={
                <ProtectedRoute>
                  <MaterialRequestsList />
                </ProtectedRoute>
              } />
              <Route path="/materials/new" element={
                <ProtectedRoute>
                  <MaterialRequestForm />
                </ProtectedRoute>
              } />
              <Route path="/materials/my-requests" element={
                <ProtectedRoute>
                  <MyMaterialRequests />
                </ProtectedRoute>
              } />
              
              {/* Classroom Calls Module */}
              <Route path="/install" element={<Install />} />
              <Route path="/chamado-sala" element={<ClassroomCallForm />} />
              <Route path="/painel-reservas" element={<PublicReservationBoard />} />
              <Route path="/classroom-calls" element={
                <ProtectedRoute>
                  <ClassroomCallsList />
                </ProtectedRoute>
              } />
              <Route path="/classroom-calls/settings" element={
                <ProtectedRoute requireAdmin>
                  <ClassroomCallSettings />
                </ProtectedRoute>
              } />
              
              {/* Tasks Module */}
              <Route path="/tasks" element={
                <ProtectedRoute>
                  <TasksList />
                </ProtectedRoute>
              } />
              <Route path="/tasks/my-tasks" element={
                <ProtectedRoute>
                  <MyTasks />
                </ProtectedRoute>
              } />
              <Route path="/tasks/dashboard" element={
                <ProtectedRoute>
                  <TasksDashboard />
                </ProtectedRoute>
              } />
              
              
              {/* Room Reservations Module */}
              <Route path="/reservations" element={
                <ProtectedRoute>
                  <RoomReservationsList />
                </ProtectedRoute>
              } />
              <Route path="/reservations/new" element={
                <ProtectedRoute>
                  <NewReservationForm />
                </ProtectedRoute>
              } />
              <Route path="/reservations/rooms" element={
                <ProtectedRoute requireAdmin>
                  <ReservationRoomsManagement />
                </ProtectedRoute>
              } />

              {/* Labels Module */}
              <Route path="/labels" element={
                <ProtectedRoute>
                  <LabelTemplatesList />
                </ProtectedRoute>
              } />
              <Route path="/labels/new" element={
                <ProtectedRoute>
                  <LabelTemplateEditor />
                </ProtectedRoute>
              } />
              <Route path="/labels/edit/:id" element={
                <ProtectedRoute>
                  <LabelTemplateEditor />
                </ProtectedRoute>
              } />
              <Route path="/labels/generate/:id" element={
                <ProtectedRoute>
                  <LabelGenerate />
                </ProtectedRoute>
              } />

              {/* Portal do Cliente - external public routes */}
              <Route path="/portal-cliente/login" element={<PortalLogin />} />
              <Route path="/portal-cliente/cadastro" element={<PortalSignup />} />
              <Route path="/portal-cliente" element={<PortalLayout />}>
                <Route index element={<Navigate to="/portal-cliente/dashboard" replace />} />
                <Route path="dashboard" element={<PortalDashboard />} />
                <Route path="nova-reserva" element={<PortalNewReservation />} />
                <Route path="minhas-reservas" element={<PortalMyReservations />} />
              </Route>

              {/* External users approval (admin) */}
              <Route path="/external-users-approval" element={
                <ProtectedRoute requireAdmin>
                  <ExternalUsersApproval />
                </ProtectedRoute>
              } />

              {/* Legacy routes */}
              <Route path="/register" element={
                <ProtectedRoute>
                  <RegisterItem />
                </ProtectedRoute>
              } />
              <Route path="/items" element={
                <ProtectedRoute>
                  <ItemsList />
                </ProtectedRoute>
              } />
              <Route path="/items/:id" element={
                <ProtectedRoute>
                  <ItemDetail />
                </ProtectedRoute>
              } />
              <Route path="/history" element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              } />
              
              {/* System - Admin only */}
              <Route path="/users" element={
                <ProtectedRoute requireAdmin>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="/permissions" element={
                <ProtectedRoute requireAdmin>
                  <Permissions />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/activity-history" element={
                <ProtectedRoute>
                  <ActivityHistory />
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<NotFound />} />
              </Routes>
            </OfflineProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
