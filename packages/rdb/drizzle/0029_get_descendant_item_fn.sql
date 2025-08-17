CREATE OR REPLACE FUNCTION public.get_descendant_item_ids(p_folder_ids uuid[], p_space_id uuid)
 RETURNS TABLE(id uuid)
 LANGUAGE sql
 STABLE
AS $function$
    WITH RECURSIVE tree AS (
        SELECT i.id, i.item_type
        FROM item i
        WHERE i.id = ANY(p_folder_ids)

        UNION ALL

        SELECT i.id, i.item_type
        FROM item i
        JOIN tree t ON i.parent_id = t.id
    )
    SELECT id
    FROM tree
    WHERE item_type='file';
$function$

