import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Home from "./pages/Home";
import RegisterItem from "./pages/RegisterItem";
import ItemsList from "./pages/ItemsList";
import ItemDetail from "./pages/ItemDetail";
import History from "./pages/History";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// Equipment Module
import EquipmentList from "./pages/equipment/EquipmentList";
import EquipmentRegister from "./pages/equipment/EquipmentRegister";
import EquipmentLoans from "./pages/equipment/EquipmentLoans";
import EquipmentLoanForm from "./pages/equipment/EquipmentLoanForm";

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
import ExternalBooking from "./pages/reservations/ExternalBooking";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/setup" element={<Setup />} />
            
            {/* Protected Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Home />
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
            <Route path="/booking" element={<ExternalBooking />} />
            
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
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
