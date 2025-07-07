import { useQuery } from "@tanstack/react-query";
import { app } from "~/lib/fetch";

export function useBooks() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["books"],
    queryFn: async () => {
      const response = await app.books.get();
      if (!response.data) {
        throw new Error("Failed to fetch books");
      }
      return response.data;
    },
  });

  return {
    books: data,
    isLoading,
    isError,
    error,
    refetch,
  };
}
