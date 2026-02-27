import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Filter, X, Loader2, LayoutGrid, List } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ChallengeCard } from '@/components/ChallengeCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useChallenges, type Difficulty } from '@/context/ChallengeContext';
import { useAuth, type Category } from '@/context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const PAGE_SIZE = 12;
type ChallengeViewMode = 'grid' | 'list';

export default function Challenges() {
  const { challenges, isLoading, error, fetchChallenges, getAssignedChallenge } = useChallenges();
  const { availableCategories, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const categories: (Category | 'All')[] = ['All', ...availableCategories];
  const difficulties: (Difficulty | 'All')[] = ['All', 'Easy', 'Medium', 'Hard'];
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'All'>('All');
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(() => {
    const raw = Number(searchParams.get('page') || '1');
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
  });
  const [viewMode, setViewMode] = useState<ChallengeViewMode>(() =>
    searchParams.get('view') === 'list' ? 'list' : 'grid',
  );
  const [assignmentCategory, setAssignmentCategory] = useState<Category>(
    availableCategories[0] ?? 'Frontend',
  );
  const [isAssigning, setIsAssigning] = useState(false);

  // Debounced search
  useEffect(() => {
    if (search.trim() === '') return;
    
    setIsSearching(true);
    const timer = setTimeout(() => {
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (currentPage > 1) params.page = String(currentPage);
    if (viewMode === 'list') params.view = 'list';
    setSearchParams(params, { replace: true });
  }, [currentPage, setSearchParams, viewMode]);

  const filteredChallenges = useMemo(() => {
    if (!challenges) return [];
    
    return challenges.filter((challenge) => {
      const matchesSearch =
        search.trim() === '' ||
        challenge.title.toLowerCase().includes(search.toLowerCase()) ||
        challenge.description.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory =
        selectedCategory === 'All' || challenge.category === selectedCategory;
      
      const matchesDifficulty =
        selectedDifficulty === 'All' || challenge.difficulty === selectedDifficulty;

      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [challenges, search, selectedCategory, selectedDifficulty]);

  const totalPages = Math.max(1, Math.ceil(filteredChallenges.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedChallenges = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredChallenges.slice(start, start + PAGE_SIZE);
  }, [filteredChallenges, safePage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedDifficulty]);

  useEffect(() => {
    if (safePage !== currentPage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setSelectedCategory('All');
    setSelectedDifficulty('All');
    setCurrentPage(1);
  }, []);

  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (search.trim() !== '') count++;
    if (selectedCategory !== 'All') count++;
    if (selectedDifficulty !== 'All') count++;
    return count;
  }, [search, selectedCategory, selectedDifficulty]);

  const startMatchedChallenge = useCallback(async () => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      toast.error('Please log in before starting a matched challenge.');
      navigate('/login', {
        state: {
          from: '/challenges',
          intent: 'start-matched-challenge',
          assignmentCategory,
        },
      });
      return;
    }

    setIsAssigning(true);
    try {
      const assigned = await getAssignedChallenge(assignmentCategory);
      navigate(
        `/challenges/${assigned.id}?assigned=1&assignmentCategory=${encodeURIComponent(
          assignmentCategory,
        )}`,
        {
        state: {
          assignedFromMatcher: true,
          assignmentCategory,
        },
        },
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'No matching challenge available for your current seniority.';
      toast.error(message);
    } finally {
      setIsAssigning(false);
    }
  }, [
    assignmentCategory,
    getAssignedChallenge,
    isAuthenticated,
    isAuthLoading,
    navigate,
  ]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading challenges...</p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh] px-4">
          <div className="text-center max-w-md">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <X className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Failed to load challenges</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={fetchChallenges} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Handle empty state
  if (!challenges || challenges.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh] px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No challenges available</h3>
            <p className="text-muted-foreground">
              There are currently no challenges available. Please check back later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" aria-busy={isSearching}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Coding Challenges</h1>
          <p className="text-muted-foreground">
            Pick a category, get matched to your seniority, and submit for real scoring.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-semibold">Start Matched Challenge</p>
              <p className="text-sm text-muted-foreground">
                Pick a category and YoScore assigns the next challenge for your level.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Select
                value={assignmentCategory}
                onValueChange={(value: Category) => setAssignmentCategory(value)}
              >
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => void startMatchedChallenge()} disabled={isAssigning}>
                {isAssigning ? 'Assigning...' : 'Start Matched Challenge'}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search challenges by title or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10 h-11"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search text"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Desktop Filters */}
            <div className="hidden lg:flex items-center gap-3">
              {/* Category Dropdown */}
              <div className="w-48">
                <Select
                  value={selectedCategory}
                  onValueChange={(value: Category | 'All') => setSelectedCategory(value)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Difficulty Dropdown */}
              <div className="w-48">
                <Select
                  value={selectedDifficulty}
                  onValueChange={(value: Difficulty | 'All') => setSelectedDifficulty(value)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    {difficulties.map((difficulty) => (
                      <SelectItem key={difficulty} value={difficulty}>
                        {difficulty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters Button */}
              {getActiveFilterCount() > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleClearFilters}
                  className="h-11 text-muted-foreground hover:text-foreground"
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Mobile Filter Toggle */}
            <Button
              variant="outline"
              className="lg:hidden gap-2 h-11"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filters
              {getActiveFilterCount() > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                  {getActiveFilterCount()}
                </Badge>
              )}
            </Button>
          </div>

          {/* Mobile Filters Dropdown */}
          {showFilters && (
            <div className="lg:hidden mt-4 pt-4 border-t border-border">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(value: Category | 'All') => setSelectedCategory(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty</label>
                  <Select
                    value={selectedDifficulty}
                    onValueChange={(value: Difficulty | 'All') => setSelectedDifficulty(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Difficulties" />
                    </SelectTrigger>
                    <SelectContent>
                      {difficulties.map((difficulty) => (
                        <SelectItem key={difficulty} value={difficulty}>
                          {difficulty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {getActiveFilterCount() > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleClearFilters}
                  className="w-full mt-4"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {(search || selectedCategory !== 'All' || selectedDifficulty !== 'All') && (
          <div className="mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              
              {search && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  Search: "{search}"
                  <button
                    onClick={() => setSearch('')}
                    aria-label="Remove search filter"
                    className="ml-1 hover:bg-muted rounded-sm p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {selectedCategory !== 'All' && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  Category: {selectedCategory}
                  <button
                    onClick={() => setSelectedCategory('All')}
                    aria-label="Remove category filter"
                    className="ml-1 hover:bg-muted rounded-sm p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {selectedDifficulty !== 'All' && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  Difficulty: {selectedDifficulty}
                  <button
                    onClick={() => setSelectedDifficulty('All')}
                    aria-label="Remove difficulty filter"
                    className="ml-1 hover:bg-muted rounded-sm p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            </div>
          </div>
        )}

        {/* Results Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold">
              Available Challenges
              {isSearching && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  Searching...
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {filteredChallenges.length} challenge{filteredChallenges.length !== 1 ? 's' : ''} found
              {search && ` for "${search}"`}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-md border border-border p-1">
              <Button
                type="button"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 px-2"
                aria-pressed={viewMode === 'grid'}
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Grid
              </Button>
              <Button
                type="button"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 px-2"
                aria-pressed={viewMode === 'list'}
              >
                <List className="h-4 w-4 mr-1" />
                List
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                Completed
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                In Progress
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-muted border"></div>
                Not Started
              </span>
            </div>
          </div>
        </div>

        {/* Challenge Grid */}
        {filteredChallenges.length > 0 ? (
          <div className="space-y-4">
            <div className={viewMode === 'grid' ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {paginatedChallenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} viewMode={viewMode} />
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination aria-label="Challenge results pagination">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setCurrentPage((prev) => Math.max(1, prev - 1));
                      }}
                      className={safePage === 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, index) => {
                    const page = index + 1;
                    if (page !== 1 && page !== totalPages && Math.abs(page - safePage) > 1) {
                      return null;
                    }
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          isActive={page === safePage}
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage(page);
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                      }}
                      className={safePage === totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No challenges found</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              No challenges match your current filters. Try adjusting your search or filters.
            </p>
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear all filters
            </Button>
          </div>
        )}

      </main>
    </div>
  );
}
