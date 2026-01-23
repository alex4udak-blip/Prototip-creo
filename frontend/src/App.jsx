import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { InvitePage } from './pages/InvitePage';
import { ChatPage } from './pages/ChatPage';
import { useAuthStore } from './hooks/useAuth';
import { ToastContainer } from './components/UI/Toast';

// Protected Route компонент
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Invite link */}
        <Route path="/invite/:token" element={<InvitePage />} />

        {/* Protected chat */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
