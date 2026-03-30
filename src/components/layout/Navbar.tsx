import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../hooks/useNotifications'

const navItems = [
  { to: '/home', label: 'Home', icon: '🏠' },
  { to: '/map', label: 'Map', icon: '🗺️' },
  { to: '/incidents', label: 'Report', icon: '⚠️' },
  { to: '/community', label: 'Buddy', icon: '👥' },
  { to: '/schedule', label: 'Schedule', icon: '⏰' },
  { to: '/profile', label: 'Profile', icon: '👤' },
]

export default function Navbar() {
  const { profile } = useAuth()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()

  const isAdminOrSecurity = profile?.role === 'admin' || profile?.role === 'security'

  return (
    <>
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          <span className="font-bold text-primary-700 text-lg">SafeHer Campus</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="text-xs bg-primary-600 text-white font-medium px-3 py-1 rounded-full"
          >
            🖥 Dashboard
          </button>
          <button className="relative" onClick={() => navigate('/profile')}>
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                isActive ? 'text-primary-600 font-semibold' : 'text-gray-500'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
