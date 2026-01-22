import { useState } from 'react';
import { Plus, Briefcase, Calendar, Trash2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

interface WorkExperienceItem {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
}

// Mock data
const mockExperiences: WorkExperienceItem[] = [
  {
    id: '1',
    company: 'Tech Startup Inc',
    role: 'Frontend Developer',
    startDate: '2022-06',
    endDate: '2024-01',
    description: 'Built responsive web applications using React and TypeScript.',
  },
  {
    id: '2',
    company: 'Digital Agency',
    role: 'Junior Developer',
    startDate: '2021-01',
    endDate: '2022-05',
    description: 'Developed client websites and maintained existing projects.',
  },
];

export default function WorkExperience() {
  const { user, updateUser } = useAuth();
  const [experiences, setExperiences] = useState<WorkExperienceItem[]>(mockExperiences);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    company: '',
    role: '',
    startDate: '',
    endDate: '',
    description: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newExperience: WorkExperienceItem = {
      id: Date.now().toString(),
      ...formData,
    };
    setExperiences([newExperience, ...experiences]);
    setFormData({ company: '', role: '', startDate: '', endDate: '', description: '' });
    setShowForm(false);

    // Update user work experience months (simplified calculation)
    if (user) {
      const totalMonths = calculateTotalMonths([newExperience, ...experiences]);
      updateUser({ workExperienceMonths: totalMonths });
    }
  };

  const handleDelete = (id: string) => {
    const updated = experiences.filter((exp) => exp.id !== id);
    setExperiences(updated);
    if (user) {
      updateUser({ workExperienceMonths: calculateTotalMonths(updated) });
    }
  };

  const calculateTotalMonths = (exps: WorkExperienceItem[]) => {
    return exps.reduce((total, exp) => {
      const start = new Date(exp.startDate);
      const end = exp.endDate ? new Date(exp.endDate) : new Date();
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      return total + Math.max(0, months);
    }, 0);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-muted">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Work Experience</h1>
            <p className="text-muted-foreground">
              Add your work history to contribute to your trust score
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Experience
          </Button>
        </div>

        {/* Score Contribution Card */}
        <div className="bg-primary text-primary-foreground rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-foreground/80 text-sm mb-1">Experience Score Contribution</p>
              <p className="text-3xl font-bold font-mono">
                {Math.min(20, Math.floor(calculateTotalMonths(experiences) / 1.2))}/20
              </p>
            </div>
            <div className="text-right">
              <p className="text-primary-foreground/80 text-sm mb-1">Total Experience</p>
              <p className="text-2xl font-bold font-mono">
                {calculateTotalMonths(experiences)} months
              </p>
            </div>
          </div>
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Add Work Experience</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder="Company name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role / Position</Label>
                  <Input
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    placeholder="Your role"
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="month"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="month"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    placeholder="Leave empty if current"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Brief description of your work"
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Experience</Button>
              </div>
            </form>
          </div>
        )}

        {/* Experience List */}
        <div className="space-y-4">
          {experiences.length > 0 ? (
            experiences.map((exp) => (
              <div
                key={exp.id}
                className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{exp.role}</h3>
                      <p className="text-muted-foreground">{exp.company}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {formatDate(exp.startDate)} - {exp.endDate ? formatDate(exp.endDate) : 'Present'}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{exp.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete experience"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-card border border-border rounded-lg">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No work experience added yet</p>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Experience
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
