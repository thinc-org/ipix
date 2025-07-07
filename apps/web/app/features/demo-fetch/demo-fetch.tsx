import { useBooks } from "~/hooks/query/use-books";

export function DemoFetch() {
  const { books, isError, isLoading } = useBooks();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isError) {
    return <div>Error fetching books</div>;
  }

  return (
    <div>
      <h1>Books</h1>
      <ul>
        {books?.map((book) => (
          <li key={book.id}>
            {book.title} by {book.author}
          </li>
        ))}
      </ul>
    </div>
  );
}
