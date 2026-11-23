-- Corrección de categorías y duplicados (2026-11-22).
-- Cada título se revisó uno por uno: etiqueta Animación de TMDb, sinopsis y conocimiento del título.
-- Es idempotente. Los cambios llegan a las apps por la sincronización incremental.
BEGIN;

-- → serie_animada (60)
--   101 Dálmatas: La Serie (1997) [serie]: TMDb: Animación
--   Abominable y la ciudad invisible (2022) [serie]: TMDb: Animación
--   Alvin y las ardillas (1983) [serie]: TMDb: Animación
--   Arcane (2021) [serie]: TMDb: Animación
--   Arthur (1996) [serie]: TMDb: Animación
--   Astérix y Obélix: El combate de los jefes (2025) [serie]: TMDb: Animación
--   Avatar: Los Siete Refugios (2026) [serie]: TMDb: Animación
--   Barbie: La vida en la casa de sus sueños (2012) [serie]: TMDb: Animación
--   Ben 10 (2016) [serie]: TMDb: Animación
--   Black Knight-White Witch (2010) [serie]: TMDb: Animación
--   Bob Esponja (1999) [serie]: TMDb: Animación
--   Boonie Bears: Monster Plan 2 (2022) [serie]: TMDb: Animación
--   Bratz (2005) [serie]: TMDb: Animación
--   Chip y Chop: Los guardianes rescatadores (1989) [serie]: TMDb: Animación
--   Constantine: Ciudad de Demonios (2018) [serie]: TMDb: Animación
--   Cuentos de Canterlot High: MLP Equestria Girls (2017) [serie]: TMDb: Animación
--   Devil May Cry (2025) [serie]: TMDb: Animación
--   Dora y sus amigos (2014) [serie]: TMDb: Animación
--   Dreamland (2026) [serie]: TMDb: Animación
--   El bebé jefazo: Vuelta al curro (2018) [serie]: TMDb: Animación
--   El libro de la selva (2010) [serie]: TMDb: Animación
--   En busca del valle encantado: La serie (2007) [serie]: TMDb: Animación
--   Harley Quinn (2019) [serie]: TMDb: Animación
--   Horton Hears a Who! () [serie]: TMDb: Animación
--   Hotel Transilvania: La serie (2017) [serie]: TMDb: Animación
--   INVENCIBLE (2021) [serie]: TMDb: Animación
--   Invizimals (2014) [serie]: TMDb: Animación
--   Kung Fu Panda: La Leyenda de Po (2011) [serie]: TMDb: Animación
--   La chica cabra (2026) [serie]: TMDb: Animación
--   La fiesta de las salchichas: Frutopía (2024) [serie]: TMDb: Animación
--   La liga de la justicia (2001) [serie]: TMDb: Animación
--   La sirenita (1992) [serie]: TMDb: Animación
--   Las flipantes historias del Capitán Calzoncillos (2018) [serie]: TMDb: Animación
--   LEGO Frozen: luces de invierno (2016) [serie]: TMDb: Animación
--   Lluvia de albóndigas (2017) [serie]: TMDb: Animación
--   Los Casagrande (2019) [serie]: TMDb: Animación
--   Los descendientes: Wicked World (2015) [serie]: TMDb: Animación
--   Los pingüinos de Madagascar (2008) [serie]: TMDb: Animación
--   Los pitufos (1981) [serie]: TMDb: Animación
--   Mickey Mouse (2013) [serie]: TMDb: Animación
--   Minions & Gru's Diary (2017) [serie]: TMDb: Animación
--   Minúsculos (2006) [serie]: TMDb: Animación
--   Monstruos contra alienígenas (2013) [serie]: TMDb: Animación
--   Overwatch (2014) [serie]: serie de cortos animados (Blizzard)
--   Perros espaciales (2021) [serie]: TMDb: Animación
--   Pocoyó: Canciones Infantiles (2019) [serie]: dibujos animados infantiles
--   Rick y Morty (2013) [serie]: TMDb: Animación
--   Sangre de Zeus (2020) [serie]: TMDb: Animación
--   Shrek: Las historias de la ciénaga (2008) [serie]: TMDb: Animación
--   Simba: El rey león (1995) [serie]: TMDb: Animación
--   Spy Kids: Misión crucial (2018) [serie]: TMDb: Animación
--   Superman: Red Son (2009) [serie]: TMDb: Animación
--   Tangled: Short Cuts (2017) [serie]: TMDb: Animación
--   Tarzan y Jane (2017) [serie]: TMDb: Animación
--   The Adventures of Over the Hedge () [serie]: serie animada
--   The Freedom Force (1978) [serie]: TMDb: Animación
--   The Mighty Nein (2025) [serie]: TMDb: Animación
--   Todos los perros van al cielo: La Serie (1996) [serie]: TMDb: Animación
--   Ultimate Wolverine vs. Hulk (2013) [serie]: TMDb: Animación
--   Yo soy Groot (2022) [serie]: TMDb: Animación
UPDATE media SET type='serie_animada', updated_at=now() WHERE id IN ('7f97466d-50c2-48d6-912f-63cf18a809ff','f8f6801b-9c80-49eb-a434-d6b2d3b52bd5','04d1932d-9ba1-4df0-99ab-141b17c83966','9201057a-60fe-44e8-a82a-8b31052ca854','699fa1b4-bd70-43f0-a91e-aeddd44e29fc','d9d4ad9e-4d3f-4d1c-b98e-948db4ca15f3','6065fefc-3e75-4d03-84a6-0ded2d18b07f','4c15b3be-c430-4eb0-b179-695489c7e9f3','6695cd08-629c-457e-a85a-a04f58230fdd','8f8a9b00-3769-497c-9a33-3fe98bcd002b','dbdfe9ec-277f-45ae-8470-2d54548b2a97','6e685605-bac8-4e5a-a5e0-a951a07cf25a','d8f8ad49-2591-44db-a0fd-e532ef6e2cc5','113a913b-7fd6-414d-bcde-0e7751a6302a','2a2ef0ad-54a6-4223-9b35-5ba5c1875678','f1379c57-caf9-4716-9a30-473b32c076e9','2e284f6e-62e1-42a9-92cc-6ef7766407b1','eb880f6a-5674-4dd3-8db5-45fd7e76c00f','62ec35d8-5b47-4981-9e51-6a70d49c0ab1','f46120d6-ccd0-4a53-87dc-c8830c6e7e94','6b8a3b04-a52d-48a9-b86e-4107991256e2','16366402-78a7-488c-b2b6-9cd9a0340415','9c992bcd-10e2-4f28-9b01-56590c478332','704698bc-be67-4c29-92ea-9ae8e5d6dc69','af3e1f10-1777-49ef-be2f-d3d0dcc9d35e','047e6079-b588-4413-8a25-c63df9436d4c','3c1b8f0c-433f-4172-bec0-701fc9cebca7','fc8d8af4-6748-4d15-8129-460453747006','edcbb940-c56e-4ff5-84fa-0d458749ed53','d3abd525-2f51-4ce6-ad40-858f156c8d17','dcb048aa-8614-41ac-b9b3-6e5eb27075fe','831dc91c-76c2-42d0-ab47-9e7ee04dce9b','23a0da17-f58e-4e27-b7c6-9bdaab3b828b','35a70377-ff0f-4024-a391-75af359f3214','ebe4b778-9c3c-4b6b-8585-272b2cfc6192','c414b43d-3b50-4b8b-875c-827dc4f3094d','72c0986b-8cef-4b8f-9c07-d5047bf43e15','77921ab0-a00f-4693-8a79-560c64a6c984','c66d0b8c-8d6b-4217-ab85-38159bd77ed3','63299534-1ca3-4943-878d-8e221b4ab16a','ed81224e-af58-4f37-b3f6-c594ecd0833f','39e97d88-c20b-4af6-b1fd-1eea1b5178a7','1a4d6e74-506d-4572-802a-4552cdfd5eb2','e85b6728-da1a-4f8a-8431-844f94603cef','4961e98d-717d-4153-a918-c9fda102b0fa','9e04c69e-6240-4663-8ec6-0f8a13bb60eb','5c771517-693f-44df-b931-4ae3c786666f','e567b86b-7e6d-4ffa-b06e-f11e60cd543c','913e8bde-5d04-43c2-b6dc-02ec2b4f6849','cf414fd7-3bf9-4798-bce0-6127be187c2d','aeb17ba6-dfd5-461b-b9b9-dd40e6e69ddb','cbb081e9-4623-48ba-aeba-29f0b6853b1e','2c38b3cd-c97d-4fe4-9b70-690ae48633cd','f437faf0-5d8e-42ef-b2ac-4e7fbebaa207','00cf13f8-e334-4c92-a152-e39168a18f30','db35a0ed-1381-463c-a907-3e57ab2d2030','c3309485-dfda-41b8-b357-74e437be643a','b753b835-bab5-4553-a71e-88f9967d4a20','ab7e217f-bad6-4902-b7f9-2e42b8421e15','0951aacc-eefc-47e3-9e43-a662a5a954a4') AND type <> 'serie_animada';

-- → pelicula_animada (25)
--   101 dálmatas (1961) [pelicula]: TMDb: Animación
--   Antz (Hormigaz) (1998) [pelicula]: TMDb: Animación
--   Bob Esponja: Un héroe fuera del agua (2015) [pelicula]: TMDb: Animación
--   El principito (2015) [pelicula]: TMDb: Animación
--   El rey león (2019) [pelicula]: película 100% animada por computadora (2019)
--   Elpidio Valdés contra Dólar y Cañón (1983) [pelicula]: TMDb: Animación
--   Gru 2. Mi villano favorito (2013) [pelicula]: TMDb: Animación
--   Gru 3. Mi villano favorito (2017) [pelicula]: TMDb: Animación
--   La fiesta de las salchichas (2016) [pelicula]: TMDb: Animación
--   Liga de la Justicia x RWBY: Superhéroes y Cazadores: Parte 1 (2023) [pelicula]: TMDb: Animación
--   Los Croods (2013) [pelicula]: TMDb: Animación
--   Los minions (2015) [pelicula]: TMDb: Animación
--   Madagascar (2005) [pelicula]: TMDb: Animación
--   MAX (2025) [pelicula]: TMDb: Animación
--   Mufasa: El rey león (2024) [pelicula]: TMDb: Animación
--   Más vampiros en La Habana (2003) [pelicula]: TMDb: Animación
--   Ocho noches locas (2002) [pelicula]: TMDb: Animación
--   Peter Pan (1953) [pelicula]: TMDb: Animación
--   Quantum Supremacy (2026) [pelicula]: TMDb: Animación
--   Stockholm (2018) [pelicula]: TMDb: Animación
--   Teen Titans Go! La película (2018) [pelicula]: TMDb: Animación
--   TMNT: Tortugas Ninja Jóvenes Mutantes (2007) [pelicula]: TMDb: Animación
--   Toy Story: El tiempo perdido (2014) [pelicula]: TMDb: Animación
--   Vampiros en La Habana (1985) [pelicula]: TMDb: Animación
--   ¡Canta! (2016) [pelicula]: TMDb: Animación
UPDATE media SET type='pelicula_animada', updated_at=now() WHERE id IN ('adfe2d54-3031-440b-82c3-779f5c1bcea2','8ad03240-592c-4eb6-9167-6b78b07f922b','35eb27b8-9b78-4cc2-8b27-cc97046c81f3','4a08d193-487a-44f7-8ec3-526decb6825e','dbc8d1c7-ca16-4f2e-bd26-e1778c265b46','5541d634-3772-4bdd-ba94-f9ac915e3931','509714a4-afd3-40d0-9e4c-f79f46666763','eebf8993-5676-479c-a63b-c24c9c259a0b','8e999d6d-bfeb-4977-852c-7cd96f82bfe7','7b348595-04ab-44cc-bdf2-5e2a2659d6ce','cfc5490d-7a15-4e76-9cbc-7f00b1fe6264','728124b4-2cbd-4ed3-8997-26bb8c48df06','eca125f9-9c15-4aa0-873d-74686a375c1e','78d2a0e7-f16b-4555-9168-3f1d8d2a18f6','229ec55a-9271-4813-a0cd-18a958ddd726','6f14b040-5dc8-4925-b384-8f03479614ea','fecf695a-8c58-4800-acfb-c88529548cfa','428860dc-75a1-4f46-bbc9-631f967930ff','aa0af271-c70f-4735-8375-66eb31a3e0ba','359e2901-c974-440d-8437-91aa757ea3ed','d7a4dc05-3194-4517-ab00-4b1f3f64caac','619667df-ee93-4ee5-b13a-7d378eac3ed7','6760be97-d2a6-48f2-98d0-76225f12a863','b7f64375-b9e3-4307-af7d-aade5b2722c5','67f421af-ffc4-4255-9b88-5a552fc0b94a') AND type <> 'pelicula_animada';

-- → anime (1)
--   モンシェリCoCo (1972) [serie]: anime japonés de 1972
UPDATE media SET type='anime', updated_at=now() WHERE id IN ('e0becdd7-0a1e-4f74-a2b1-733610ff3b9d') AND type <> 'anime';

-- → documental (5)
--   1917 Val Duchesse (1917) [pelicula]: documental sobre la I Guerra Mundial
--   Callejeros (2005) [novela]: serie documental
--   El Charro Inmortal (1955) [pelicula]: documental sobre Jorge Negrete
--   Heaven And Hell On Earth (2001) [pelicula]: documental de FMX
--   México indomable (2018) [novela]: serie documental
UPDATE media SET type='documental', updated_at=now() WHERE id IN ('1a958f55-0bf4-4fe3-8bae-794ebe166511','6ead1c4e-ba2e-4821-9027-a405a301d1f0','27deddeb-4648-410a-a7a8-1144132b2150','25d90bfc-9a89-4078-8840-b818af698dbb','81d7169f-4f49-48a4-831c-3854a38d2d3f') AND type <> 'documental';

-- → reality (2)
--   Colombia Shore () [novela]: programa de telerrealidad
--   Premio Lo Nuestro 2026 (2026) [novela]: programa de TV / gala de premios
UPDATE media SET type='reality', updated_at=now() WHERE id IN ('19d8f9dd-e071-4570-9f2f-49fac4e3911e','1a3e1333-edcc-41a8-97fa-424b8ab24565') AND type <> 'reality';

-- → pelicula (6)
--   Jackass 2.5 (2007) [documental]: película de comedia, no documental
--   Jackass 2: Todavía más (2006) [documental]: película de comedia, no documental
--   Jackass 3.5 (2011) [documental]: película de comedia, no documental
--   Jackass 3D (2010) [documental]: película de comedia, no documental
--   Jackass presenta: Bad Grandpa .5 (2014) [documental]: película de comedia, no documental
--   This Is Me…Now: Una historia de amor (2024) [documental]: película musical, no documental
UPDATE media SET type='pelicula', updated_at=now() WHERE id IN ('919585a8-4443-4043-8ac9-3f35f430c659','0ad311c4-d9a1-4dbf-b7e7-891a1f8017f4','52b4b7c0-70b6-4baa-8214-5dae5859999c','effc2627-37c1-4d30-a449-f44d970d86b0','c1fcd444-f147-4d79-92d2-fa7568d7e679','9d2d24e2-4da1-4775-9c63-63be8995f207') AND type <> 'pelicula';

-- → serie (3)
--   Crash (2008) [novela]: serie estadounidense, no novela
--   Las reglas del juego (Leverage) (2008) [novela]: serie estadounidense, no novela
--   Las Vegas (2003) [novela]: serie estadounidense, no novela
UPDATE media SET type='serie', updated_at=now() WHERE id IN ('aaa35d51-9740-4711-89bc-21e9aaa5b9e5','7cb76789-8389-4df9-a506-4e6aa982907a','d7b5b0ca-cfbb-4bec-a995-2d02861cf0f9') AND type <> 'serie';

-- Duplicados (misma referencia de TMDb): se conserva uno por título (27 filas sobrantes).
--   tv:130853: Mono malo x2
--   tv:98916: ¡A ver si llego! x2
--   tv:82452: Avatar: La leyenda de Aang x2
--   tv:94605: Arcane x2
--   tv:215866: American Primeval x2
--   tv:157239: Alien Earth x2
--   tv:236429: Al filo del deber x2
--   tv:82791: Agencia de asuntos mágicos x2
--   tv:125940: Vampire Academy x2
--   tv:242865: ¿A qué estás esperando? x2
--   tv:245312: Un hombre infiltrado x2
--   tv:62956: 7 días al desnudo x2
--   tv:3239: 3 Libras x2
--   tv:107075: Cuestión de honor x2
--   tv:250220: La mujer miniatura x2
--   tv:32573: Contraataque x3
--   tv:113962: Operaciones Especiales: Lioness x2
--   tv:146176: Berlín x3
--   tv:246246: Beauty in Black x2
--   tv:110316: Alice in Borderland x2
--   tv:60216: La Voz x2
--   tv:299939: Monstruo: La historia de Lizzie Borden x2
--   tv:247168: Chad Powers x2
--   tv:245914: Renacer x2
--   tv:1622: Sobrenatural x2
INSERT INTO media_tombstones (id) SELECT id FROM media WHERE id IN ('6eb45bdf-d976-493f-bb23-2a7f0f33a31e','01452a98-c99c-470c-95ca-cfef4fcf8a11','987a0e73-9943-4477-99f5-d0da9a43cf22','a015086e-2ec5-473b-a305-39713093c704','99f2349c-936b-4cf7-8d81-ef9bffffa8f9','8b3bab4d-530c-443b-9e49-0f70ad736578','ce70cfd0-3e3f-449b-a62d-68620b2df4a2','e6262bf9-85a3-4956-9acf-a0e95fb27770','da3e8d69-df7b-47c9-9613-605e70c6add8','ac26bf4b-3bb2-4385-bb8f-41f7180d6fec','4dd57503-d81c-43ef-bc81-4f32ca606136','29858a10-f477-4030-994c-64903b07d378','81472c1e-e0cb-465a-a3f6-56511f8c2bff','1691aed7-6ce4-4db5-89cd-6146e5209100','971c9303-d2eb-45ef-b88d-cde098140ad4','caf8b9fb-7ac9-402a-9a0a-08e9f7a3c32e','d0d16eae-a752-489a-9230-259b0d1d0f10','e2d1f38e-9afd-48b0-8f94-788af45c5542','1c452fbd-50a5-4da1-92e2-b983765286a4','c2bef6a2-954f-4e64-99c8-d15144c9f3e6','bce09454-db2b-4d52-a64d-a99b36ead8d5','d54f5c5a-726f-4b05-b768-364bebe9706c','e4f996a4-2274-4127-a853-83dd1f6e57c2','5c3c8c39-8708-4747-b164-595ef342b78e','b9d0f5cd-5268-489a-89c2-55a09c1ff92f','3132d13a-7226-4a4d-8718-5606774ed016','f9f51cc6-f463-4161-87da-cf877e4b9eb4') ON CONFLICT (id) DO UPDATE SET deleted_at = now();
DELETE FROM media WHERE id IN ('6eb45bdf-d976-493f-bb23-2a7f0f33a31e','01452a98-c99c-470c-95ca-cfef4fcf8a11','987a0e73-9943-4477-99f5-d0da9a43cf22','a015086e-2ec5-473b-a305-39713093c704','99f2349c-936b-4cf7-8d81-ef9bffffa8f9','8b3bab4d-530c-443b-9e49-0f70ad736578','ce70cfd0-3e3f-449b-a62d-68620b2df4a2','e6262bf9-85a3-4956-9acf-a0e95fb27770','da3e8d69-df7b-47c9-9613-605e70c6add8','ac26bf4b-3bb2-4385-bb8f-41f7180d6fec','4dd57503-d81c-43ef-bc81-4f32ca606136','29858a10-f477-4030-994c-64903b07d378','81472c1e-e0cb-465a-a3f6-56511f8c2bff','1691aed7-6ce4-4db5-89cd-6146e5209100','971c9303-d2eb-45ef-b88d-cde098140ad4','caf8b9fb-7ac9-402a-9a0a-08e9f7a3c32e','d0d16eae-a752-489a-9230-259b0d1d0f10','e2d1f38e-9afd-48b0-8f94-788af45c5542','1c452fbd-50a5-4da1-92e2-b983765286a4','c2bef6a2-954f-4e64-99c8-d15144c9f3e6','bce09454-db2b-4d52-a64d-a99b36ead8d5','d54f5c5a-726f-4b05-b768-364bebe9706c','e4f996a4-2274-4127-a853-83dd1f6e57c2','5c3c8c39-8708-4747-b164-595ef342b78e','b9d0f5cd-5268-489a-89c2-55a09c1ff92f','3132d13a-7226-4a4d-8718-5606774ed016','f9f51cc6-f463-4161-87da-cf877e4b9eb4');
UPDATE catalog_meta SET updated_at = now();
SELECT type, count(*) FROM media GROUP BY 1 ORDER BY 2 DESC;
COMMIT;
