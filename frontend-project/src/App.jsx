import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardPage    from './pages/DashboardPage'
import DeviceManagePage from './pages/DeviceManagePage'
import ArInspectPage    from './pages/ArInspectPage'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"  element={<DashboardPage />} />
        <Route path="/devices"    element={<DeviceManagePage />} />
        <Route path="/ar-inspect" element={<ArInspectPage />} />
      </Routes>
    </BrowserRouter>
  )
}
