import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ExternalProtectedRoute } from "@/components/ExternalProtectedRoute";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import Setup from "./pages/Setup";
import Home from "./pages/Home";
import RegisterItem from "./pages/RegisterItem";
import ItemsList from "./pages/ItemsList";
import ItemDetail from "./pages/ItemDetail";
import History from "./pages/History";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import DashboardStats from "./pages/DashboardStats";
import NotFound from "./pages/NotFound";
import Permissions from "./pages/Permissions";
import ActivityHistory from "./pages/ActivityHistory";

// Equipment Module
import EquipmentList from "./pages/equipment/EquipmentList";
import EquipmentRegister from "./pages/equipment/EquipmentRegister";
import EquipmentLoans from "./pages/equipment/EquipmentLoans";
import EquipmentLoanForm from "./pages/equipment/EquipmentLoanForm";
import ExternalEquipmentRequestsList from "./pages/equipment/ExternalEquipmentRequestsList";


// Lockers Module
import LockersList from "./pages/lockers/LockersList";
import LockerLoanForm from "./pages/lockers/LockerLoanForm";
import LockerLoans from "./pages/lockers/LockerLoans";

// Rooms Module
import RoomsList from "./pages/rooms/RoomsList";
import ChecklistForm from "./pages/rooms/ChecklistForm";
import ChecklistHistory from "./pages/rooms/ChecklistHistory";

// Reservations Module
import ReservationRoomsList from "./pages/reservations/ReservationRoomsList";
import ReservationsList from "./pages/reservations/ReservationsList";
import ReservationForm from "./pages/reservations/ReservationForm";
import ReservationsCalendar from "./pages/reservations/ReservationsCalendar";
import ReservationLogs from "./pages/reservations/ReservationLogs";
import ReservationApprovals from "./pages/reservations/ReservationApprovals";
import ExternalBooking from "./pages/reservations/ExternalBooking";
import ReschedulingsList from "./pages/reservations/ReschedulingsList";

// Materials Module
import MaterialRequestsList from "./pages/materials/MaterialRequestsList";
import MaterialRequestForm from "./pages/materials/MaterialRequestForm";
import MyMaterialRequests from "./pages/materials/MyMaterialRequests";

// Classroom Calls Module
import ClassroomCallForm from "./pages/classroom/ClassroomCallForm";
import ClassroomCallsList from "./pages/classroom/ClassroomCallsList";

// Tasks Module
import TasksList from "./pages/tasks/TasksList";
import MyTasks from "./pages/tasks/MyTasks";
import TasksDashboard from "./pages/tasks/TasksDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin-auth" element={<AdminAuth />} />
            <Route path="/setup" element={<Setup />} />
            
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
            <Route path="/equipment/external-requests" element={
              <ProtectedRoute>
                <ExternalEquipmentRequestsList />
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
            
            {/* Reservations Module */}
            <Route path="/reservations" element={
              <ProtectedRoute>
                <ReservationRoomsList />
              </ProtectedRoute>
            } />
            <Route path="/reservations/list" element={
              <ProtectedRoute>
                <ReservationsList />
              </ProtectedRoute>
            } />
            <Route path="/reservations/new" element={
              <ProtectedRoute>
                <ReservationForm />
              </ProtectedRoute>
            } />
            <Route path="/reservations/calendar" element={
              <ProtectedRoute>
                <ReservationsCalendar />
              </ProtectedRoute>
            } />
            <Route path="/reservations/logs" element={
              <ProtectedRoute>
                <ReservationLogs />
              </ProtectedRoute>
            } />
            <Route path="/reservations/approvals" element={
              <ProtectedRoute>
                <ReservationApprovals />
              </ProtectedRoute>
            } />
            <Route path="/reservations/reschedulings" element={
              <ProtectedRoute>
                <ReschedulingsList />
              </ProtectedRoute>
            } />
            <Route path="/booking-auth" element={<Navigate to="/auth" replace />} />
            <Route path="/booking" element={
              <ExternalProtectedRoute>
                <ExternalBooking />
              </ExternalProtectedRoute>
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
            <Route path="/chamado-sala" element={<ClassroomCallForm />} />
            <Route path="/classroom-calls" element={
              <ProtectedRoute>
                <ClassroomCallsList />
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
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
