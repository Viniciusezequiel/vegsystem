import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
        <Routes>
          {/* Home Dashboard */}
          <Route path="/" element={<Home />} />
          
          {/* Lost and Found Module */}
          <Route path="/lost-found" element={<ItemsList />} />
          <Route path="/lost-found/register" element={<RegisterItem />} />
          <Route path="/lost-found/items" element={<ItemsList />} />
          <Route path="/lost-found/items/:id" element={<ItemDetail />} />
          <Route path="/lost-found/history" element={<History />} />
          
          {/* Equipment Module (placeholder) */}
          <Route path="/equipment" element={<NotFound />} />
          <Route path="/equipment/loans" element={<NotFound />} />
          
          {/* Rooms Module (placeholder) */}
          <Route path="/rooms" element={<NotFound />} />
          <Route path="/rooms/checklists" element={<NotFound />} />
          
          {/* Lockers Module (placeholder) */}
          <Route path="/lockers" element={<NotFound />} />
          <Route path="/lockers/allocations" element={<NotFound />} />
          
          {/* Legacy routes (redirect support) */}
          <Route path="/register" element={<RegisterItem />} />
          <Route path="/items" element={<ItemsList />} />
          <Route path="/items/:id" element={<ItemDetail />} />
          <Route path="/history" element={<History />} />
          
          {/* System */}
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
