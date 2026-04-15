import { Routes, Route, Navigate } from 'react-router-dom'
import AdminDashboard from './pages/AdminDashboard.jsx'
import StudentInterface from './pages/StudentInterface.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/seat/:seatId" element={<StudentInterface />} />
    </Routes>
  )
}
