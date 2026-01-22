import { useState } from 'react';
import { User, Mail, Lock, Save } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ScoreCard } from '@/components/ScoreCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader } from '@/components/Loader';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Please log in to view your profile</p>
            <Link to="/login">
              <Button>Login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    updateUser({ name: formData.name, email: formData.email });
    setIsEditing(false);
    setIsSaving(false);
    setFormData((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
  };

  return (
    <div className="min-h-screen bg-muted">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your account information and view your scores
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Account Information</h2>
                {!isEditing ? (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                  />
                </div>

                {isEditing && (
                  <>
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-4">
                        Leave password fields empty to keep current password
                      </p>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentPassword" className="flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Current Password
                          </Label>
                          <Input
                            id="currentPassword"
                            name="currentPassword"
                            type="password"
                            value={formData.currentPassword}
                            onChange={handleInputChange}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="newPassword" className="flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            New Password
                          </Label>
                          <Input
                            id="newPassword"
                            name="newPassword"
                            type="password"
                            value={formData.newPassword}
                            onChange={handleInputChange}
                          />
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
                      {isSaving ? (
                        <Loader size="sm" className="border-primary-foreground" />
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Score Summary */}
          <div className="space-y-6">
            <ScoreCard
              title="Total Trust Score"
              score={user.totalScore}
              trustLevel={user.trustLevel}
              size="lg"
              colorVariant="primary"
            />

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Category Breakdown</h3>
              <div className="space-y-4">
                {user.categoryScores.map((cat, index) => {
                  const colors = [
                    'bg-[hsl(210,80%,50%)]',
                    'bg-[hsl(270,60%,55%)]',
                    'bg-[hsl(25,90%,55%)]',
                    'bg-[hsl(175,70%,40%)]',
                    'bg-[hsl(330,70%,55%)]',
                  ];
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground text-sm">{cat.category}</span>
                        <span className="font-mono font-medium text-sm">{cat.score}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${colors[index % colors.length]}`}
                          style={{ width: `${cat.score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
