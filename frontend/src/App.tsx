import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ChallengeProvider } from "@/context/ChallengeContext";

import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import Challenges from "./pages/Challenges";
import ChallengeDetail from "./pages/ChallengeDetail";
import WorkExperience from "./pages/WorkExperience";
import Profile from "./pages/Profile";
import SubmissionResult from "./pages/SubmissionResult";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import About from "./pages/About";
import HowItWorks from "./pages/HowItWorks";
import { AdminRoute } from "./components/guards/AdminRoute";
import ConnectionTest from "./components/ConnectionTest";
import { SubmissionStatusTracker } from "./components/SubmissionStatusTracker";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ChallengeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SubmissionStatusTracker />
            <Routes>
              {/*<Route path="" element={<ConnectionTest />} />*/}
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/challenges/:id" element={<ChallengeDetail />} />
              <Route path="/work-experience" element={<WorkExperience />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/submissions/:id" element={<SubmissionResult />} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ChallengeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
