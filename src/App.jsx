import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocialProvider, useSocial } from './context/SocialContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LoginGate } from './components/layout/LoginGate';
import { Feed } from './components/feed/Feed';
import { GroupRooms } from './components/groups/GroupRooms';
import { ChatView } from './components/chat/ChatView';
import { FriendsList } from './components/friends/FriendsList';
import { ProfileView } from './components/profile/ProfileView';
import { AuthModal } from './components/auth/AuthModal';
import { ProModal } from './components/auth/ProModal';
import { AgeGate, isAgeVerified } from './components/auth/AgeGate';
import { Rss, MessageCircle, Users, User, Flame, Heart } from 'lucide-react';

const MainContent = () => {
  const { currentUser, authLoading } = useAuth();
  const { unreadMessageCount } = useSocial();
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'groups' | 'chat' | 'friends' | 'profile'
  const [selectedUserForProfile, setSelectedUserForProfile] = useState(null);
  const [selectedChatUser, setSelectedChatUser] = useState(null);

  const handleOpenChatWithUser = (targetUser) => {
    setSelectedChatUser(targetUser);
    setActiveTab('chat');
  };

  const handleSelectUser = (targetUser) => {
    setSelectedUserForProfile(targetUser);
    setActiveTab('profile');
  };

  // Distinct from just setActiveTab('profile') — that alone would leave a
  // previously-selected other person's profile in place (e.g. after
  // viewing someone from the feed, then coming back to "Meu Perfil").
  const handleOpenOwnProfile = () => {
    setSelectedUserForProfile(null);
    setActiveTab('profile');
  };

  const isOwnProfileActive = activeTab === 'profile' && !selectedUserForProfile;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-600/30 animate-pulse">
          <Heart className="w-6 h-6 text-white fill-current" />
        </div>
        <p className="text-xs font-semibold text-[var(--c-text-muted)]">Carregando LoveVibe...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginGate />
        <AuthModal />
        <ProModal />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-[var(--c-text)] flex flex-col font-sans selection:bg-rose-500 selection:text-[var(--c-text)]">
      <Navbar
        onOpenProfile={handleOpenOwnProfile}
        onOpenFriends={() => setActiveTab('friends')}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOwnProfileActive={isOwnProfileActive}
          onOpenOwnProfile={handleOpenOwnProfile}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 pb-24 md:pb-8 overflow-y-auto">
          {activeTab === 'feed' && (
            <Feed
              onOpenChatWithUser={handleOpenChatWithUser}
              onSelectUser={handleSelectUser}
            />
          )}

          {activeTab === 'groups' && (
            <GroupRooms />
          )}

          {activeTab === 'chat' && (
            <ChatView
              selectedTargetUser={selectedChatUser}
              onSelectUser={handleSelectUser}
            />
          )}

          {activeTab === 'friends' && (
            <FriendsList
              onOpenChatWithUser={handleOpenChatWithUser}
              onSelectUser={handleSelectUser}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              user={selectedUserForProfile || currentUser}
              onOpenChatWithUser={handleOpenChatWithUser}
              onSelectUser={handleSelectUser}
            />
          )}
        </main>
      </div>

      {/* Mobile & Tablet Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--c-surface-2)]/95 backdrop-blur-2xl border-t border-rose-500/20 px-2 py-1.5 flex items-center justify-around z-40 shadow-2xl">
        {[
          { id: 'feed', label: 'Feed', icon: Rss },
          { id: 'groups', label: 'Grupos', icon: Flame, badge: 'VIP', badgeColor: 'bg-amber-500 text-black' },
          { id: 'chat', label: 'Chat', icon: MessageCircle, badge: unreadMessageCount > 0 ? (unreadMessageCount > 9 ? '9+' : unreadMessageCount) : null, badgeColor: 'bg-rose-600 text-white' },
          { id: 'friends', label: 'Amigos', icon: Users },
          { id: 'profile', label: 'Perfil', icon: User }
        ].map(item => {
          const isActive = item.id === 'profile' ? isOwnProfileActive : activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => item.id === 'profile' ? handleOpenOwnProfile() : setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 relative py-1 px-2.5 min-w-[50px] min-h-[44px] rounded-2xl transition active:scale-95 ${
                isActive ? 'text-rose-500 font-bold bg-rose-500/10' : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{item.label}</span>
              {item.badge && (
                <span className={`absolute top-0.5 right-1.5 text-[7px] font-black px-1 py-0.5 rounded-full leading-none ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Modals */}
      <AuthModal />
      <ProModal />
    </div>
  );
};

export function App() {
  const [ageVerified, setAgeVerified] = useState(isAgeVerified);

  if (!ageVerified) {
    return <AgeGate onConfirm={() => setAgeVerified(true)} />;
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <SocialProvider>
            <MainContent />
          </SocialProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
