# Changelog

## 1.0.0 (2026-09-18)


### Features

* add activity logging foundation and password reset fix ([fbfceb0](https://github.com/BonnieSpannah/safari-shule/commit/fbfceb08dd8659b862812cdbf9bac8749f8a36fe))
* **api:** add vehicle-level one-active-trip database invariant ([9e5fb57](https://github.com/BonnieSpannah/safari-shule/commit/9e5fb57685695e61264eb30bddd8c6ea29234401))
* **api:** driver workspace, one-active-trip invariant, cancellation ([e849df6](https://github.com/BonnieSpannah/safari-shule/commit/e849df69d63c36aa0ea36a40493d9edef1d99d72))
* **api:** driver-initiated student board/alight endpoints ([d941ba0](https://github.com/BonnieSpannah/safari-shule/commit/d941ba05a4cabb26ec8036eda98abd5b4d2b5df0))
* **api:** enforce one-active-trip-per-vehicle invariant in startTrip and updateAssignment ([750680f](https://github.com/BonnieSpannah/safari-shule/commit/750680f76c864a9653a5270015ab8b67ad725309))
* **api:** staff-user link, invite guards, roles expansion ([37da048](https://github.com/BonnieSpannah/safari-shule/commit/37da04851aeaa05a79130566d4dfff70560f43ed))
* **devops:** add bin/herd-setup.sh for Laravel Herd local setup ([90763d7](https://github.com/BonnieSpannah/safari-shule/commit/90763d7fb8fcfd48fc3790590096a96726e9bf00))
* **m4:** standardize data-table controls and wire admin MVP runtime ([e89d806](https://github.com/BonnieSpannah/safari-shule/commit/e89d80645d8dd7c47808ce5faee99867ad2f14ed))
* **m4:** wire Prometheus metrics, DNC, Bull Board, audit event sink ([86d9a76](https://github.com/BonnieSpannah/safari-shule/commit/86d9a76e3de0982c205497bc51e28d90cb9b8e0a))
* **mobile:** add role-aware driver workflows ([1e79b6c](https://github.com/BonnieSpannah/safari-shule/commit/1e79b6c57b7c3b92b16316bb0e5d7e81ad690d0f))
* **mobile:** add student lookup sheet and board/alight providers ([52f0b90](https://github.com/BonnieSpannah/safari-shule/commit/52f0b90f822a89cbe676ed6e5fe614e685de7282))
* **mobile:** cancelled trip view uses shared shell; unify all trip statuses ([1c3382a](https://github.com/BonnieSpannah/safari-shule/commit/1c3382ae8c468be69a05e579298a296ec9dedcbd))
* **mobile:** carry tenant display name through session storage ([776a904](https://github.com/BonnieSpannah/safari-shule/commit/776a9048e3df90c3300507ec7aa49cdb58df5661))
* **mobile:** completed trip view uses shared shell ([9c3beaf](https://github.com/BonnieSpannah/safari-shule/commit/9c3beaf1e716e55206b9af499008e401356a5c53))
* **mobile:** redesign login screen with centered, branded layout ([1f465fc](https://github.com/BonnieSpannah/safari-shule/commit/1f465fcf380cdc874baaf384939f60129e967d2e))
* **mobile:** reorder recent trips row — status left, completion time right ([dde17e0](https://github.com/BonnieSpannah/safari-shule/commit/dde17e020a671229b738a92fa0c860dea268f911))
* **mobile:** reorder upcoming trip row — time left, vehicle+direction right ([a5ec58a](https://github.com/BonnieSpannah/safari-shule/commit/a5ec58a36226e006d4b87e6555835c6601fb34ca))
* **mobile:** restore active trip telemetry across login and app resume ([291d3bd](https://github.com/BonnieSpannah/safari-shule/commit/291d3bd10526a153ba32e782daa9cbfd2a4800d2))
* **mobile:** scaffold app with auth shells offline and ci ([e3ff84c](https://github.com/BonnieSpannah/safari-shule/commit/e3ff84c66e797183921cf1b2faff8ee44f393c32))
* **mobile:** scheduled trip view uses shared map+chips shell ([6290602](https://github.com/BonnieSpannah/safari-shule/commit/62906028af4df71839559fb8f63386ddf5bbbfc8))
* **mobile:** show tenant display name in driver app bar ([ae3ae4f](https://github.com/BonnieSpannah/safari-shule/commit/ae3ae4ff1a315d63f1094ac5cefa820acfa3be7a))
* **mobile:** show tenant name and title-cased role on account screen ([2ce454c](https://github.com/BonnieSpannah/safari-shule/commit/2ce454cab41658f69c6b20a8c0830b3b2c2a9975))
* **mobile:** status-aware trip detail screen, dashboard reorder, SOS real-location fix ([f2dbd58](https://github.com/BonnieSpannah/safari-shule/commit/f2dbd58a3895879212e07ae3a258783e6fbbf34b))
* **mobile:** task-first driver dashboard, login guard, docs ([f47902f](https://github.com/BonnieSpannah/safari-shule/commit/f47902fca2b596a30b79d850dd5fedda69a57934))
* **mobile:** typed trip models, map policy, providers ([fb684de](https://github.com/BonnieSpannah/safari-shule/commit/fb684de73f099169a22364d52c6d7d9aa362faee))
* **mobile:** upcoming trip card mirrors in-progress design with map preview and passenger count ([2f5877a](https://github.com/BonnieSpannah/safari-shule/commit/2f5877ae0f5ee50666f6ce44149504ad9c545842))
* **mobile:** wire student onboarding into start-trip flow and alighting into in-progress panel ([e3baac8](https://github.com/BonnieSpannah/safari-shule/commit/e3baac85936a058b5b8eed48df267d902dbd96e5))
* one-command bootstrap + go-to-market pitch drop ([d0a3874](https://github.com/BonnieSpannah/safari-shule/commit/d0a3874a3e27fff9486af53ae9e7499e3dc4e805))
* **platform:** tenants CRUD, identity lifecycle, Docker fixes ([b4b1934](https://github.com/BonnieSpannah/safari-shule/commit/b4b19346c22e6d282a66d24558e484d24c4fd9b9))
* scaffold web admin (Savanna design system) + governance foundation ([da692c0](https://github.com/BonnieSpannah/safari-shule/commit/da692c03b6bfd43a7b9fdcd3368b342b60495c33))
* tenant selector on fleet + routes; fix missing PATCH /v1/routes/:id ([bc7913b](https://github.com/BonnieSpannah/safari-shule/commit/bc7913bc7638aa263f2f505269881626367f6e53))
* **trips:** add reassignment flow with audit trail ([048e9c5](https://github.com/BonnieSpannah/safari-shule/commit/048e9c551036b4dfd92842bf82db5deb7863107a))
* **trips:** assistant trip workflows (M7.5) ([5db50d8](https://github.com/BonnieSpannah/safari-shule/commit/5db50d86a393418a7aa91b567aa102e650d1ebee))
* **trips:** enforce one active driver trip ([3d44590](https://github.com/BonnieSpannah/safari-shule/commit/3d44590d740a753d23139af83d7edb8ededb0ab9))
* **web+api:** M2 back-office portal — Students, Fleet, Routes, Parents, Settings (Users+Staff) ([6495977](https://github.com/BonnieSpannah/safari-shule/commit/64959772877a44c274ac10fe7bfc61bd03038eb9))
* **web+api:** M3 complete — DataTable v3 export, e2e suite green ([ac28ef4](https://github.com/BonnieSpannah/safari-shule/commit/ac28ef42edd5b04bae712e933fd0dca7d977ea66))
* **web:** add error handling and audit events to all screens (Phase 2) ([c9f57b7](https://github.com/BonnieSpannah/safari-shule/commit/c9f57b73c4f3508cc127c24355038b73d8b615e1))
* **web:** add impersonation & audit integration (Phase 1B) ([dd65d0a](https://github.com/BonnieSpannah/safari-shule/commit/dd65d0a66fe8307a9954077aa185526849dd2589))
* **web:** add state management components (ErrorState, LoadingState) ([43ce935](https://github.com/BonnieSpannah/safari-shule/commit/43ce935315375b5ba50af467bc7a7322d12a3dc0))
* **web:** add view detail dialogs to fleet, routes, trips, incidents; uniform View label ([cb6c210](https://github.com/BonnieSpannah/safari-shule/commit/cb6c210eee82372583168f092c68c96491ccb0d6))
* **web:** m2 web screens - error states, audit events, impersonation, type safety ([e683ac3](https://github.com/BonnieSpannah/safari-shule/commit/e683ac38cb80761578426e974f486ba112941aa6))
* **web:** platform admin UI — tenant list, detail, filters, pagination, native dev workflow ([a9f553e](https://github.com/BonnieSpannah/safari-shule/commit/a9f553e966779a89846bcc39b0103983b24e9aba))
* **web:** refine filters and settings tabs ([352512e](https://github.com/BonnieSpannah/safari-shule/commit/352512e58990466f298c9a0b05d075e31ed4dee9))
* **web:** staff-user invite flow, routes map, trip improvements ([67193aa](https://github.com/BonnieSpannah/safari-shule/commit/67193aab9437e111ea3570430733de0c3df31e5e))
* **web:** surface vehicle/driver active-trip conflict message on trip actions ([e7191ca](https://github.com/BonnieSpannah/safari-shule/commit/e7191ca93347f171916e7f9039bd70c29be669ba))


### Bug Fixes

* **api+web+e2e:** final review fixes — dashboard RBAC, tenant filter on single-entity reads, xlsx→exceljs, sosInput schema, trips isolation assertions ([3d95bfb](https://github.com/BonnieSpannah/safari-shule/commit/3d95bfb0af2e1bcfd817953b35d016fd7c6fd1a3))
* end-to-end demo readiness — CORS, tenant header, refresh token, migration ([a6062ff](https://github.com/BonnieSpannah/safari-shule/commit/a6062ff1d0bb79c87e674d0f34afd5ff4c867e9e))
* finalize activity and cross-platform verification ([30879b1](https://github.com/BonnieSpannah/safari-shule/commit/30879b1e011060ec47b293fe9f27684bed26d999))
* **mobile:** keep live passenger counts, allow mid-route boarding ([8965350](https://github.com/BonnieSpannah/safari-shule/commit/8965350709a39cc9f6f8ac878378c1d5bb14f533))
* **mobile:** read activeTripId from nested details, surface trip conflicts ([d7056c1](https://github.com/BonnieSpannah/safari-shule/commit/d7056c1e412e7ecd36b04c3ada9f4450364508d9))
* **mobile:** resolve Android plugin build dependencies ([c0c900e](https://github.com/BonnieSpannah/safari-shule/commit/c0c900ec353aab1751c29146cd0cb3257867195d))
* **onboarding:** invite flow — correct tenant, cleanup orphans, unified activation ([9f4fece](https://github.com/BonnieSpannah/safari-shule/commit/9f4fece41155db4a040607f7df1682f957fb4fe4))
* super-admin visibility, user CRUD, dashboard, env alignment ([fda938b](https://github.com/BonnieSpannah/safari-shule/commit/fda938b1b5d387fbca27a0f732f4682335cabbde))
* **web:** student/guardian - tenant-aware edit, cross-tenant save, view details, link student ([1017275](https://github.com/BonnieSpannah/safari-shule/commit/10172756eced701c424aedeb06464bfca285fa08))


### Reverts

* **docs:** remove m6 quickstart docs, revert session-handoff m6 status ([fe21123](https://github.com/BonnieSpannah/safari-shule/commit/fe21123b211a14f8979b5f2583c6f2033747a4f4))
