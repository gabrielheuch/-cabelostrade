import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from '@getmocha/users-service/react';
import HomePage from "./pages/Home";
import AuthCallbackPage from "./pages/AuthCallback";
import ProductsPage from "./pages/Products";
import ProductDetailPage from "./pages/ProductDetail";
import ProfilePage from "./pages/Profile";
import SellPage from "./pages/Sell";
import EditProductPage from "./pages/EditProduct";
import TransactionsPage from "./pages/Transactions";
import ChatPage from "./pages/Chat";
import AdminPage from "./pages/Admin";
import PublicProfilePage from "./pages/PublicProfile";
import AboutPage from "./pages/About";
import Navbar from "./components/Navbar";

export default function App() {
  return (
<AuthProvider>
  <Router>
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/produtos" element={<ProductsPage />} />
        <Route path="/produto/:id" element={<ProductDetailPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/vender" element={<SellPage />} />
        <Route path="/editar-produto/:id" element={<EditProductPage />} />
        <Route path="/transacoes" element={<TransactionsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/perfil-publico/:userId" element={<PublicProfilePage />} />
        <Route path="/quem-somos" element={<AboutPage />} />
      </Routes>
    </div>
  </Router>
</AuthProvider>
  );
}
