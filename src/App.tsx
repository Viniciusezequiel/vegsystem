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
            
            {/* Equipment Module (placeholder) */}
            <Route path="/equipment" element={
              <ProtectedRoute>
                <NotFound />
              </ProtectedRoute>
            } />
            <Route path="/equipment/loans" element={
              <ProtectedRoute>
                <NotFound />
              </ProtectedRoute>
            } />
            
            {/* Rooms Module (placeholder) */}
            <Route path="/rooms" element={
              <ProtectedRoute>
                <NotFound />
              </ProtectedRoute>
            } />
            <Route path="/rooms/checklists" element={
              <ProtectedRoute>
                <NotFound />
              </ProtectedRoute>
            } />
            
            {/* Lockers Module (placeholder) */}
            <Route path="/lockers" element={
              <ProtectedRoute>
                <NotFound />
              </ProtectedRoute>
            } />
            <Route path="/lockers/allocations" element={
              <ProtectedRoute>
                <NotFound />
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
