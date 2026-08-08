import React from 'react';
import { Home, Map, PlusCircle, Users, User } from 'lucide-react';

export type NavTab = 'home' | 'map' | 'report' | 'walk' | 'profile';

interface MobileNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'home' as NavTab, label: 'Home', icon: Home },
    { id: 'map' as NavTab, label: 'Safety Map', icon: Map },
    { id: 'report' as NavTab, label: 'Report', icon: PlusCircle, highlight: true },
    { id: 'walk' as NavTab, label: 'Walk With Me', icon: Users },
    { id: 'profile' as NavTab, label: 'Profile', icon: User },
  ];

  return (
    <nav className="mobile-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            className={`nav-item ${isActive ? 'active' : ''} ${tab.highlight ? 'nav-highlight' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <div className="nav-icon-container">
              <Icon size={tab.highlight ? 22 : 20} />
            </div>
            <span className="nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
