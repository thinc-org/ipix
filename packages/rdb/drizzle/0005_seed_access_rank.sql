-- Custom SQL migration file, put your code below! --

INSERT INTO access_rank(access_type, rank) VALUES ('public',1000),('team',2000),('owner',3000)  ON CONFLICT DO NOTHING;