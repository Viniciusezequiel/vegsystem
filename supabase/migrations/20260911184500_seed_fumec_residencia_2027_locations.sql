-- Seed FUMEC room structure for RESIDÊNCIA MÉDICA 2027 and add capacity snapshot.

ALTER TABLE public.ps_event_collaborators
  ADD COLUMN IF NOT EXISTS room_capacity integer;

WITH target_location AS (
  INSERT INTO public.ps_locations (name, address, active)
  VALUES ('FUMEC', 'R. Cobre, 200 - Cruzeiro, Belo Horizonte - MG, 30310-150', true)
  ON CONFLICT (name_key)
  DO UPDATE SET address = EXCLUDED.address, active = true
  RETURNING id
),
location_row AS (
  SELECT id FROM target_location
  UNION ALL
  SELECT id FROM public.ps_locations WHERE name_key = 'fumec'
  LIMIT 1
),
building_seed(name) AS (
  VALUES ('FACE I'), ('FACE II'), ('FCH'), ('FEA')
)
INSERT INTO public.ps_location_buildings (location_id, name, active)
SELECT l.id, b.name, true
FROM location_row l CROSS JOIN building_seed b
ON CONFLICT (location_id, name_key)
DO UPDATE SET active = true;

WITH l AS (
  SELECT id FROM public.ps_locations WHERE name_key = 'fumec' LIMIT 1
),
room_seed(building, floor, room, capacity) AS (
  VALUES
    ('FACE I','1º','A120',NULL),
    ('FACE I','1º','ÁREA EXTERNA',NULL),
    ('FACE I','3º','A303',45),
    ('FACE I','3º','A304',50),
    ('FACE I','3º','A305',50),
    ('FACE I','3º','A306',50),
    ('FACE I','3º','A307',50),
    ('FACE I','3º','A308',40),
    ('FACE I','3º','A309',45),
    ('FACE I','3º','A310',40),
    ('FACE I','3º','A314',50),
    ('FACE I','3º','A315',50),
    ('FACE I','3º','A316',50),
    ('FACE I','3º','A317',50),
    ('FACE I','3º','A318',50),
    ('FACE I','3º','A319',50),
    ('FACE I','4º','A401',50),
    ('FACE I','4º','A402',50),
    ('FACE I','4º','A403',50),
    ('FACE I','4º','A404',50),
    ('FACE I','4º','A405',50),
    ('FACE I','4º','A406',50),
    ('FACE I','4º','A407',50),
    ('FACE I','4º','A408',45),
    ('FACE I','4º','A409 - AUDITÓRIO',90),
    ('FACE I','4º','A410',45),
    ('FACE I','4º','A411',50),
    ('FACE I','4º','A412',50),
    ('FACE I','4º','A413',50),
    ('FACE I','4º','A414',50),
    ('FACE I','4º','A415',50),
    ('FACE I','4º','A416',50),
    ('FACE I','4º','A417',50),
    ('FACE II','SUBSOLO','ES104',54),
    ('FACE II','SUBSOLO','ES105',40),
    ('FACE II','1º','E105',NULL),
    ('FACE II','1º','E106',NULL),
    ('FACE II','1º','E107',45),
    ('FACE II','1º','E108',45),
    ('FACE II','1º','E109',45),
    ('FACE II','1º','E110 - AUDITÓRIO',86),
    ('FACE II','1º','E112',45),
    ('FACE II','1º','E113',45),
    ('FACE II','1º','E114',45),
    ('FACE II','1º','E115',NULL),
    ('FACE II','2º','E201',50),
    ('FACE II','2º','E202',50),
    ('FACE II','2º','E203',50),
    ('FACE II','2º','E204',50),
    ('FACE II','2º','E205',50),
    ('FACE II','2º','E206',50),
    ('FACE II','2º','E207',45),
    ('FACE II','2º','E208',45),
    ('FACE II','2º','E209',40),
    ('FACE II','2º','E210',40),
    ('FACE II','2º','E211',45),
    ('FACE II','2º','E212',45),
    ('FACE II','2º','E213',45),
    ('FACE II','3º','E301',50),
    ('FACE II','3º','E302',50),
    ('FACE II','3º','E303',50),
    ('FACE II','3º','E304',50),
    ('FACE II','3º','E305',50),
    ('FACE II','4º','E402',50),
    ('FACE II','4º','E403',50),
    ('FACE II','4º','E404',50),
    ('FACE II','4º','E405',50),
    ('FCH','TÉRREO','ÁREA EXTERNA',NULL),
    ('FCH','TÉRREO','BS128',30),
    ('FCH','1º','B101',NULL),
    ('FCH','1º','B102',NULL),
    ('FCH','1º','B105',45),
    ('FCH','1º','B111',45),
    ('FCH','1º','B112',35),
    ('FCH','1º','B121',15),
    ('FCH','1º','C101',40),
    ('FCH','1º','C102',40),
    ('FCH','2º','B201',50),
    ('FCH','2º','B202',50),
    ('FCH','2º','B203',50),
    ('FCH','2º','B204',50),
    ('FCH','2º','B205',25),
    ('FCH','2º','B207',35),
    ('FCH','2º','B208',NULL),
    ('FCH','2º','B211',50),
    ('FCH','2º','B212',50),
    ('FCH','2º','B213',50),
    ('FCH','2º','B214',50),
    ('FCH','2º','B215',50),
    ('FCH','2º','B216',50),
    ('FCH','2º','B217',50),
    ('FCH','2º','C201',40),
    ('FCH','2º','C202',40),
    ('FCH','2º','C203',40),
    ('FCH','2º','C204',40),
    ('FCH','2º','C205',40),
    ('FCH','2º','C206',40),
    ('FCH','3º','AUDITÓRIO PHOENIX',300),
    ('FCH','3º','B301',50),
    ('FCH','3º','B302',50),
    ('FCH','3º','B303',50),
    ('FCH','3º','B304',50),
    ('FCH','3º','B305',20),
    ('FCH','3º','B306',20),
    ('FCH','3º','B307',30),
    ('FCH','3º','B309',20),
    ('FCH','3º','B310 - AUDITÓRIO',NULL),
    ('FCH','3º','B311',50),
    ('FCH','3º','B312',50),
    ('FCH','3º','B313',50),
    ('FCH','3º','B314',50),
    ('FCH','3º','B315',50),
    ('FCH','3º','B316',50),
    ('FEA','1º','F101',1),
    ('FEA','1º','F102',1),
    ('FEA','1º','F103',1),
    ('FEA','1º','F104',1),
    ('FEA','1º','F105',1),
    ('FEA','2º','F201',50),
    ('FEA','2º','F202',50),
    ('FEA','2º','F203',1),
    ('FEA','2º','F204',1),
    ('FEA','2º','F207',35),
    ('FEA','2º','F216',NULL),
    ('FEA','3º','F301',50),
    ('FEA','3º','F302',50),
    ('FEA','3º','F303',50),
    ('FEA','3º','F306',50),
    ('FEA','3º','F307',48),
    ('FEA','3º','F308',1),
    ('FEA','3º','F311',45),
    ('FEA','3º','F313',2),
    ('FEA','3º','AUDITÓRIO',NULL),
    ('FEA','4º','F416',25),
    ('FEA','4º','F417',50),
    ('FEA','5º','F501',50),
    ('FEA','5º','F502',50),
    ('FEA','5º','F503',50),
    ('FEA','5º','F506',50),
    ('FEA','5º','F507',49),
    ('FEA','5º','F509',50),
    ('FEA','5º','F510',40),
    ('FEA','5º','F511',10),
    ('FEA','5º','F512',20),
    ('FEA','6º','F601',45),
    ('FEA','6º','F602',45),
    ('FEA','6º','F605',45),
    ('FEA','6º','F606',45),
    ('FEA','3º','F331',50),
    ('FEA','3º','F332',50),
    ('FEA','5º','F531',50),
    ('FEA','5º','F532',50),
    ('FEA','6º','F631',50),
    ('FEA','6º','F632',50),
    ('FEA','7º','F731',50),
    ('FEA','7º','F732',50)
)
INSERT INTO public.ps_location_rooms (building_id, floor, room, capacity, active)
SELECT b.id, r.floor, r.room, r.capacity, true
FROM room_seed r
JOIN l ON true
JOIN public.ps_location_buildings b
  ON b.location_id = l.id AND b.name_key = lower(btrim(r.building))
ON CONFLICT (building_id, floor_key, room_key)
DO UPDATE SET capacity = EXCLUDED.capacity, active = true;

INSERT INTO public.ps_event_locations (event_id, location_id)
SELECT e.id, l.id
FROM public.ps_events e
JOIN public.ps_locations l ON l.name_key = 'fumec'
WHERE lower(btrim(e.name)) = lower('RESIDÊNCIA MÉDICA 2027')
  AND e.date = DATE '2026-09-27'
ON CONFLICT DO NOTHING;

SELECT public.ps_refresh_event_location_label(e.id)
FROM public.ps_events e
WHERE lower(btrim(e.name)) = lower('RESIDÊNCIA MÉDICA 2027')
  AND e.date = DATE '2026-09-27';
