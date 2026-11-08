-- Garlic joins the crop catalogue (src/lib/cropCatalogue.json). PSA records
-- it as "Garlic, dried bulb"; no DA growing time yet. Left alone if staff
-- already added a crop by that name.
INSERT INTO "CropType" ("name", "category", "aliases", "psaProductionTable", "psaProduction", "psaPriceTable", "psaPrice")
VALUES ('Garlic', 'Herbs and spices', ARRAY['garlic', 'bawang', 'ahos']::text[], '2E/CS/0082E4EVCP3.px', 'Garlic, dried bulb', '2M/NFG/0032M4AFN04.px', 'Garlic, dried bulb')
ON CONFLICT ("name") DO NOTHING;
