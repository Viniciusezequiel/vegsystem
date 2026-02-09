"use client";

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
import AdminAuth from "@/views/AdminAuth";
import Setup from "@/views/Setup";
import Home from "@/views/Home";
import RegisterItem from "@/views/RegisterItem";
import ItemsList from "@/views/ItemsList";
import ArchivedItemsList from "@/views/ArchivedItemsList";
import ItemDetail from "@/views/ItemDetail";
import History from "@/views/History";
import Users from "@/views/Users";
import Settings from "@/views/Settings";
import Reports from "@/views/Reports";
import DashboardStats from "@/views/DashboardStats";
import NotFound from "@/views/NotFound";
import Permissions from "@/views/Permissions";
import ActivityHistory from "@/views/ActivityHistory";
import ChangePassword from "@/views/ChangePassword";

// Equipment Module
import EquipmentList from "@/views/equipment/EquipmentList";
import EquipmentRegister from "@/views/equipment/EquipmentRegister";
import EquipmentLoans from "@/views/equipment/EquipmentLoans";
import EquipmentLoanForm from "@/views/equipment/EquipmentLoanForm";
import EquipmentReservations from "@/views/equipment/EquipmentReservations";

// Lockers Module
import LockersList from "@/views/lockers/LockersList";
import LockerLoanForm from "@/views/lockers/LockerLoanForm";
import LockerLoans from "@/views/lockers/LockerLoans";

// Rooms Module
import RoomsList from "@/views/rooms/RoomsList";
import ChecklistForm from "@/views/rooms/ChecklistForm";
import ChecklistHistory from "@/views/rooms/ChecklistHistory";
import ShiftHandoverForm from "@/views/rooms/ShiftHandoverForm";
import ShiftHandoverHistory from "@/views/rooms/ShiftHandoverHistory";

// Materials Module
import MaterialRequestsList from "@/views/materials/MaterialRequestsList";
import MaterialRequestForm from "@/views/materials/MaterialRequestForm";
import MyMaterialRequests from "@/views/materials/MyMaterialRequests";

// Classroom Calls Module
import ClassroomCallForm from "@/views/classroom/ClassroomCallForm";
import ClassroomCallsList from "@/views/classroom/ClassroomCallsList";

// Tasks Module
import TasksList from "@/views/tasks/TasksList";
import MyTasks from "@/views/tasks/MyTasks";
import TasksDashboard from "@/views/tasks/TasksDashboard";

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
            </OfflineProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
