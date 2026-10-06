# Élections québécoises, 1867–2026

Site statique de visualisation des 44 élections générales québécoises : frise chronologique, hémicycle, carte des circonscriptions sur les frontières de chaque époque, historique par circonscription, évolution des votes et des sièges, et comparaison du scrutin réel avec une simulation par élimination et transferts configurables par parti.

## Voir le site

```sh
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

Pour le publier : GitHub → Settings → Pages → déployer depuis la branche principale, dossier racine.

## Données

| Période | Source | Contenu |
|---|---|---|
| 1867–2022 | [Atlas of Canadian Elections](https://github.com/zacktayloruwo/atlas-canada-elections) (Zack Taylor, Western) | résultats par candidat et circonscription, frontières historiques |
| 2026 | [Données bleues](https://github.com/AurelienNicosiaULaval/donnees-bleues-elections-qc) (A. Nicosia, U. Laval), d'après Élections Québec | résultats du 5 octobre 2026 (état du 6 octobre, 15 h 16), carte 2026 |
| 2026 | [Élections Québec, portrait socioéconomique](https://docs.electionsquebec.qc.ca/PRO/6a58edde4eab9/statistiques-recensement-2021-CEP2026.xls) (adapté de Statistique Canada, Recensement 2021; licence ouverte de Statistique Canada) | scolarité, revenu et âge par circonscription (section « profil des circonscriptions ») |

Les résultats 2026 sont ceux du fil d'Élections Québec au moment de la collecte; à revalider après la proclamation. Vérification : votes valides, inscrits et sièges 2012–2022 identiques entre les deux sources.

Regénérer les fichiers de `data/` :

```sh
scripts/fetch_sources.sh                                   # clone les deux sources dans ./sources
python3 scripts/build_data.py                              # pandas + pyarrow
# placer le XLS d'Élections Québec dans sources/statistiques-recensement-2021-CEP2026.xls, puis :
python3 scripts/build_demo.py                              # numpy + xlrd
TOOLS=<dossier avec mapshaper et topojson-client> TMPGEO=/tmp/geo node scripts/build_geo.mjs
```

L'Atlas ne précise pas de licence explicite pour ses données; il compile des sources publiques (Assemblée nationale, Fondation Lionel-Groulx, Élections Québec). Citer les auteurs et vérifier auprès d'eux avant toute réutilisation commerciale.

Comprend des données ouvertes octroyées sous la licence d'utilisation des données ouvertes du directeur général des élections disponible à l'adresse Web dgeq.org. L'octroi de la licence n'implique aucune approbation par le directeur général des élections de l'utilisation des données ouvertes qui en est faite.

## Profil socioéconomique (`data/demo.json`)

`scripts/build_demo.py` croise les résultats avec le profil du Recensement de 2021 des 127 circonscriptions de 2026 (Élections Québec, licence ouverte de Statistique Canada) : scolarité, revenu total moyen, âge, langues française et anglaise, immigration, locataires et densité (population ÷ superficie).
Le profil de 2022 n'existe pas officiellement sur la carte de 2017 : il est estimé par interpolation pondérée par la population (table de correspondance des cartes de Données bleues). Contrôle : sur les 105 circonscriptions presque inchangées, les corrélations diffèrent en moyenne de 0,014 de celles de l'estimation complète.
Les liens sont des corrélations entre circonscriptions (erreur écologique).
