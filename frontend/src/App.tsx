import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { ChallengeProvider } from "@/context/ChallengeContext";

import { AdminRoute } from "./components/guards/AdminRoute";
import { SubmissionStatusTracker } from "./components/SubmissionStatusTracker";
import { DemoCredentialsDialog } from "./components/DemoCredentialsDialog";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Challenges = lazy(() => import("./pages/Challenges"));
const ChallengeDetail = lazy(() => import("./pages/ChallengeDetail"));
const WorkExperience = lazy(() => import("./pages/WorkExperience"));
const Profile = lazy(() => import("./pages/Profile"));
const SubmissionResult = lazy(() => import("./pages/SubmissionResult"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const About = lazy(() => import("./pages/About"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));

const queryClient = new QueryClient();

const RouteLoadingFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground" role="status" aria-live="polite">
    Loading page...
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ChallengeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SubmissionStatusTracker />
            <DemoCredentialsDialog />
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
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
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </ChallengeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
