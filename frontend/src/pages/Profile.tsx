import { useEffect, useState } from 'react';
import { User, Mail, Save } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ScoreCard } from '@/components/ScoreCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader } from '@/components/Loader';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import { dashboardService } from '@/services/dashboardService';
import { toast } from 'react-hot-toast';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string' && response.data.message.trim()) {
      return response.data.message;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
      });
    }
  }, [user]);

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
    setFormData((previous) => ({ ...previous, [e.target.name]: e.target.value }));
    if (saveError) {
      setSaveError(null);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveError(null);
    setFormData({
      name: user.name || '',
      email: user.email || '',
    });
  };

  const handleSave = async () => {
    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
    };

    if (!payload.name || !payload.email) {
      setSaveError('Name and email are required.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const updatedProfile = await dashboardService.updateProfile(payload);
      updateUser({
        name: updatedProfile.name,
        email: updatedProfile.email,
      });
      setIsEditing(false);
      toast.success('Profile updated');
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to update profile.');
      setSaveError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your account information and view your scores
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Account Information</h2>
                {!isEditing ? (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={handleCancel}>
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
                    disabled={!isEditing || isSaving}
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
                    disabled={!isEditing || isSaving}
                  />
                </div>

                {saveError && (
                  <p className="text-sm text-destructive" role="alert">
                    {saveError}
                  </p>
                )}

                {isEditing && (
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
                )}
              </div>
            </div>
          </div>

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
