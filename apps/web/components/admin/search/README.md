# Admin Search System

A comprehensive, high-performance search system for the admin panel built with TanStack Query, React hooks, and modern UI components.

## Features

### 🔍 **Core Search Capabilities**
- **Real-time search** with debounced input (300ms)
- **Full-text search** with PostgreSQL ILIKE queries
- **Server-side pagination** for optimal performance
- **Search highlighting** with customizable styles
- **Search suggestions** with recent/popular queries
- **Search history** with localStorage persistence

### 🎛️ **Advanced Filtering**
- **Multi-field filters** (text, select, checkbox, date, dateRange)
- **Collapsible filter panels** with active filter indicators
- **Filter state persistence** in URL parameters
- **Clear all filters** functionality

### 📊 **Smart Pagination**
- **Intelligent page controls** with ellipsis for large datasets
- **Page size options** (25, 50, 100 items per page)
- **Result count display** with search context
- **Keyboard navigation** support

### ⚡ **Performance Optimizations**
- **TanStack Query caching** with configurable stale times
- **Server-side caching** with Next.js `unstable_cache`
- **Request deduplication** and background refetching
- **Optimistic updates** for better UX
- **Query prefetching** for instant results

### 🔄 **State Management**
- **URL synchronization** for shareable searches
- **Search state persistence** across page reloads
- **Debounced search** to prevent excessive API calls
- **Loading states** and error handling

## Components

### Core Components

#### `SearchInput`
```tsx
<SearchInput
  value={search}
  onChange={setSearch}
  placeholder="Search users..."
  isLoading={isLoading}
  debounceMs={300}
  showClearButton={true}
  showSearchIcon={true}
/>
```

#### `SearchResults`
```tsx
<SearchResults
  isLoading={isLoading}
  isEmpty={results.length === 0}
  emptyMessage="No results found"
  searchTerm={searchTerm}
>
  {results.map(renderItem)}
</SearchResults>
```

#### `SearchPagination`
```tsx
<SearchPagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setPage}
  totalItems={totalCount}
  itemsPerPage={limit}
  showPageNumbers={true}
  maxVisiblePages={5}
/>
```

#### `SearchFilters`
```tsx
<SearchFilters
  filters={filterConfig}
  onClearAll={clearFilters}
  title="User Filters"
  collapsible={true}
  defaultCollapsed={true}
/>
```

### Advanced Components

#### `SearchHighlight`
```tsx
<SearchHighlight
  text={user.name}
  searchTerm={searchTerm}
  highlightClassName="bg-yellow-200 font-semibold"
/>
```

#### `SearchSuggestions`
```tsx
<SearchSuggestions
  suggestions={suggestions}
  onSuggestionSelect={handleSuggestion}
  onClearHistory={clearHistory}
  maxSuggestions={8}
/>
```

### Entity-Specific Components

#### `UserSearch`
```tsx
<UserSearch
  onUserSelect={handleUserSelect}
  onUserEdit={handleUserEdit}
  onUserDelete={handleUserDelete}
  showFilters={true}
  showSorting={true}
  showRefresh={true}
/>
```

#### `GroupSearch`
```tsx
<GroupSearch
  onGroupSelect={handleGroupSelect}
  onGroupEdit={handleGroupEdit}
  onGroupDelete={handleGroupDelete}
  showFilters={true}
  showSorting={true}
  showRefresh={true}
/>
```

## Hooks

### `useSearchState`
Manages search state with URL synchronization:

```tsx
const searchState = useSearchState({
  defaultSearch: "",
  defaultPage: 1,
  defaultLimit: 50,
  syncWithUrl: true,
  urlParamPrefix: "user_",
});

// Access state
const { search, page, limit, filters } = searchState;

// Update state
searchState.updateSearch("new query");
searchState.updatePage(2);
searchState.updateFilter("status", "active");
```

### `useUserSearch`
TanStack Query hook for user search:

```tsx
const { data, isLoading, error } = useUserSearch({
  search: "john",
  page: 1,
  limit: 50,
  sortBy: "created_at",
  sortOrder: "desc",
});
```

### `useSearchHistory`
Manages search history and suggestions:

```tsx
const searchHistory = useSearchHistory({
  maxItems: 50,
  storageKey: "user-search-history",
});

// Add to history
searchHistory.addToHistory("search query", 25);

// Get suggestions
const recent = searchHistory.getRecentQueries(5);
const popular = searchHistory.getPopularQueries(3);
const suggestions = searchHistory.getSuggestions("partial", 5);
```

## Query Keys

Centralized query key management:

```tsx
import { searchKeys } from "@/lib/data/search-query-keys";

// User search queries
const userQueryKey = searchKeys.users({ search: "john", page: 1 });
const userDetailKey = searchKeys.user("user-id");

// Group search queries
const groupQueryKey = searchKeys.groups({ isActive: true });
const groupDetailKey = searchKeys.group("group-id");
```

## Server Actions

Optimized server actions with caching:

```tsx
// Cached user search with 5-minute cache
const getCachedUsers = unstable_cache(
  async (search, page, limit) => {
    // Search implementation
  },
  ["admin-users-search"],
  { 
    revalidate: 300,
    tags: ["admin-users", "users-search"] 
  }
);
```

## Performance Features

### Caching Strategy
- **Client-side**: TanStack Query with 5-minute stale time
- **Server-side**: Next.js `unstable_cache` with 5-minute revalidation
- **Query invalidation**: Automatic cache invalidation on mutations

### Search Optimizations
- **Debounced input**: 300ms delay to prevent excessive API calls
- **Server-side pagination**: Only fetch required data
- **Query deduplication**: Automatic request deduplication
- **Background refetching**: Fresh data when window regains focus

### UI Optimizations
- **Virtual scrolling**: For large result sets (planned)
- **Skeleton loading**: Smooth loading states
- **Optimistic updates**: Immediate UI feedback
- **Error boundaries**: Graceful error handling

## Usage Examples

### Basic User Search
```tsx
import { UserSearch } from "@/components/admin/search";

function AdminUsersPage() {
  return (
    <div>
      <h1>User Management</h1>
      <UserSearch
        onUserSelect={(user) => console.log("Selected:", user)}
        onUserEdit={(user) => openEditDialog(user)}
        onUserDelete={(userId) => deleteUser(userId)}
      />
    </div>
  );
}
```

### Custom Search Implementation
```tsx
import { useSearchState, useUserSearch } from "@/hooks";
import { SearchInput, SearchResults, SearchPagination } from "@/components/admin/search";

function CustomUserSearch() {
  const searchState = useSearchState();
  const { data, isLoading } = useUserSearch({
    search: searchState.debouncedSearch,
    page: searchState.page,
    limit: searchState.limit,
  });

  return (
    <div>
      <SearchInput
        value={searchState.search}
        onChange={searchState.updateSearch}
        placeholder="Search users..."
      />
      
      <SearchResults isLoading={isLoading} isEmpty={!data?.users.length}>
        {data?.users.map(user => (
          <UserCard key={user.id} user={user} />
        ))}
      </SearchResults>
      
      <SearchPagination
        currentPage={data?.currentPage || 1}
        totalPages={data?.totalPages || 1}
        onPageChange={searchState.updatePage}
      />
    </div>
  );
}
```

## Migration Guide

### From Old Search System

1. **Replace manual state management**:
   ```tsx
   // Old
   const [search, setSearch] = useState("");
   const [page, setPage] = useState(1);
   
   // New
   const searchState = useSearchState();
   ```

2. **Replace manual API calls**:
   ```tsx
   // Old
   const [users, setUsers] = useState([]);
   useEffect(() => {
     fetchUsers(search, page).then(setUsers);
   }, [search, page]);
   
   // New
   const { data: users } = useUserSearch({ search, page });
   ```

3. **Replace manual pagination**:
   ```tsx
   // Old
   <div className="pagination">
     <button onClick={() => setPage(page - 1)}>Previous</button>
     <span>Page {page}</span>
     <button onClick={() => setPage(page + 1)}>Next</button>
   </div>
   
   // New
   <SearchPagination
     currentPage={page}
     totalPages={totalPages}
     onPageChange={setPage}
   />
   ```

## Best Practices

1. **Use entity-specific search components** when possible
2. **Implement proper error boundaries** for search components
3. **Use search history** to improve user experience
4. **Implement proper loading states** and skeleton screens
5. **Cache search results** appropriately based on data volatility
6. **Use URL state synchronization** for shareable searches
7. **Implement proper TypeScript types** for all search interfaces
8. **Test search functionality** with various edge cases

## Future Enhancements

- [ ] **Full-text search** with PostgreSQL full-text search
- [ ] **Search analytics** and usage tracking
- [ ] **Saved searches** and search templates
- [ ] **Advanced filters** with date ranges and complex queries
- [ ] **Export functionality** for search results
- [ ] **Bulk operations** on search results
- [ ] **Search shortcuts** and keyboard navigation
- [ ] **Real-time search** with WebSocket updates
