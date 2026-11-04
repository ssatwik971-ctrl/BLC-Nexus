import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import PublicLayout from './components/PublicLayout.jsx';
import MemberLayout from './components/MemberLayout.jsx';
import { SkeletonBlock } from './components/ui.jsx';

import Home from './pages/public/Home.jsx';
import About from './pages/public/About.jsx';
import Leaderboard from './pages/public/Leaderboard.jsx';
import Apply from './pages/public/Apply.jsx';
import ApplicationStatus from './pages/public/ApplicationStatus.jsx';
import Contact from './pages/public/Contact.jsx';
import { Login, AdminLogin, ForgotPassword, SetPassword } from './pages/public/AuthPages.jsx';
import NotFound from './pages/public/NotFound.jsx';

import Dashboard from './pages/member/Dashboard.jsx';
import Roster from './pages/member/Roster.jsx';
import Maintenance from './pages/member/Maintenance.jsx';
import Donations from './pages/member/Donations.jsx';
import { ForumHome, ForumCategory, ForumThread } from './pages/member/Forums.jsx';
import { WikiList, WikiPage } from './pages/member/Wiki.jsx';
import Votes from './pages/member/Votes.jsx';
import Documents from './pages/member/Documents.jsx';
import Performance from './pages/member/Performance.jsx';
import Profile from './pages/member/Profile.jsx';

import AdminApplications from './pages/admin/AdminApplications.jsx';
import AdminMembers from './pages/admin/AdminMembers.jsx';
import AdminSite from './pages/admin/AdminSite.jsx';
import AdminResources from './pages/admin/AdminResources.jsx';
import AdminLogs from './pages/admin/AdminLogs.jsx';

/** Gate a route tree by login and (optionally) a minimum role. */
function Protected({ min, children }) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <SkeletonBlock rows={5} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (min && !hasRole(min)) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/apply" element={<Apply />} />
        <Route path="/apply/status/:token" element={<ApplicationStatus />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<SetPassword mode="reset" />} />
        <Route path="/accept-invite" element={<SetPassword mode="invite" />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route
        path="/app"
        element={
          <Protected>
            <MemberLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="roster" element={<Roster />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="donations" element={<Donations />} />
        <Route path="forums" element={<ForumHome />} />
        <Route path="forums/category/:id" element={<ForumCategory />} />
        <Route path="forums/thread/:id" element={<ForumThread />} />
        <Route path="wiki" element={<WikiList />} />
        <Route path="wiki/:slug" element={<WikiPage />} />
        <Route path="votes" element={<Votes />} />
        <Route path="documents" element={<Documents />} />
        <Route path="performance" element={<Performance />} />
        <Route path="profile" element={<Profile />} />

        {/* Only the admin approves applications; officers handle the rest of the management pages. */}
        <Route path="admin/applications" element={<Protected min="ADMIN"><AdminApplications /></Protected>} />
        <Route path="admin/members" element={<Protected min="OFFICER"><AdminMembers /></Protected>} />
        <Route path="admin/resources" element={<Protected min="OFFICER"><AdminResources /></Protected>} />
        <Route path="admin/site" element={<Protected min="OFFICER"><AdminSite /></Protected>} />
        <Route path="admin/logs" element={<Protected min="OFFICER"><AdminLogs /></Protected>} />
      </Route>
    </Routes>
  );
}
