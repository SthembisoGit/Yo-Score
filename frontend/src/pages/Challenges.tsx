import { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ChallengeCard } from '@/components/ChallengeCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useChallenges, type Difficulty } from '@/context/ChallengeContext';
import { useAuth, type Category } from '@/context/AuthContext';

export default function Challenges() {
  const { challenges } = useChallenges();
  const { availableCategories } = useAuth();
  const categories: (Category | 'All')[] = ['All', ...availableCategories];
  const difficulties: (Difficulty | 'All')[] = ['All', 'Easy', 'Medium', 'Hard'];
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'All'>('All');
  const [showFilters, setShowFilters] = useState(false);

  const filteredChallenges = useMemo(() => {
    return challenges.filter((challenge) => {
      const matchesSearch =
        challenge.title.toLowerCase().includes(search.toLowerCase()) ||
        challenge.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All' || challenge.category === selectedCategory;
      const matchesDifficulty =
        selectedDifficulty === 'All' || challenge.difficulty === selectedDifficulty;

      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [challenges, search, selectedCategory, selectedDifficulty]);

  return (
    <div className="min-h-screen bg-muted">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Coding Challenges</h1>
          <p className="text-muted-foreground">
            Test your skills across frontend, backend, and security domains
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search challenges..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Toggle (Mobile) */}
            <Button
              variant="outline"
              className="sm:hidden gap-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>

            {/* Desktop Filters */}
            <div className="hidden sm:flex gap-2">
              {/* Category Filter */}
              <div className="flex border border-border rounded-md overflow-hidden">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      selectedCategory === category
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card hover:bg-muted'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Difficulty Filter */}
              <div className="flex border border-border rounded-md overflow-hidden">
                {difficulties.map((difficulty) => (
                  <button
                    key={difficulty}
                    onClick={() => setSelectedDifficulty(difficulty)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      selectedDifficulty === difficulty
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card hover:bg-muted'
                    }`}
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Filters */}
          {showFilters && (
            <div className="sm:hidden mt-4 pt-4 border-t border-border space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Category</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        selectedCategory === category
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Difficulty</p>
                <div className="flex flex-wrap gap-2">
                  {difficulties.map((difficulty) => (
                    <button
                      key={difficulty}
                      onClick={() => setSelectedDifficulty(difficulty)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        selectedDifficulty === difficulty
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {difficulty}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <p className="text-sm text-muted-foreground mb-4">
          Showing {filteredChallenges.length} challenge
          {filteredChallenges.length !== 1 ? 's' : ''}
        </p>

        {/* Challenge Grid */}
        {filteredChallenges.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <p className="text-muted-foreground">No challenges match your filters</p>
            <Button
              variant="link"
              onClick={() => {
                setSearch('');
                setSelectedCategory('All');
                setSelectedDifficulty('All');
              }}
              className="mt-2"
            >
              Clear filters
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
