import { useQuery, useMutation } from "@tanstack/react-query";
import app from '@/lib/fetch'

export function spaceFn() {
  const getAssociatedSpace = useQuery({
    queryKey: ["getAssociatedSpace"],
    queryFn: () => {
      return app.space["associated-space"].get({query: {}})
    },
  });

  const getMyIpixItem = useQuery({
    queryKey: ["getMyIpix"],
    queryFn: () => {
      return app.space["associated-space"].get({query: {name: "myipix", match: "exact"}})
    },
  });

  const isAssociatedWithSpace = useQuery({
    queryKey: ["isAssociatedWithSpace"],
    queryFn: () => {
      return app.space["associated-space"]
    }
  })

  const createInitialUserSpace = useMutation({
    mutationFn: () => {
      return app.space["create-space"].post({
        name: "myipix",
        spaceType: "personal",
        accessType: "owner"
      })
    }
  });

  return {
    getAssociatedSpace,
    createInitialUserSpace,
    isAssociatedWithSpace,
    getMyIpixItem
  };
}
