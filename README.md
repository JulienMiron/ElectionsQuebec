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

Les résultats 2026 sont ceux du fil d'Élections Québec au moment de la collecte; à revalider après la proclamation. Vérification : votes valides, inscrits et sièges 2012–2022 identiques entre les deux sources.

Regénérer les fichiers de `data/` :

```sh
scripts/fetch_sources.sh                                   # clone les deux sources dans ./sources
python3 scripts/build_data.py                              # pandas + pyarrow
TOOLS=<dossier avec mapshaper et topojson-client> TMPGEO=/tmp/geo node scripts/build_geo.mjs
```

L'Atlas ne précise pas de licence explicite pour ses données; il compile des sources publiques (Assemblée nationale, Fondation Lionel-Groulx, Élections Québec). Citer les auteurs et vérifier auprès d'eux avant toute réutilisation commerciale.

Comprend des données ouvertes octroyées sous la licence d'utilisation des données ouvertes du directeur général des élections disponible à l'adresse Web dgeq.org. L'octroi de la licence n'implique aucune approbation par le directeur général des élections de l'utilisation des données ouvertes qui en est faite.
