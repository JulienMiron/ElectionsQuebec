# =====================================================================
# Collecte des données ouvertes d'Élections Québec (provincial)
#
# Mention obligatoire (licence DGEQ) :
# « Comprend des données ouvertes octroyées sous la licence d'utilisation
#   des données ouvertes du directeur général des élections disponible à
#   l'adresse Web dgeq.org. L'octroi de la licence n'implique aucune
#   approbation par le directeur général des élections de l'utilisation
#   des données ouvertes qui en est faite. »
# =====================================================================

library(readr)
library(dplyr)
library(purrr)

base_arch <- "https://donnees.electionsquebec.qc.ca/production/provincial/resultats/archives"
base_live <- "https://donnees.electionsquebec.qc.ca/production/provincial/resultats"
racine    <- "donnees_eq"
dir.create(racine, showWarnings = FALSE)

# Identifiants des élections générales archivées (voir dgeq.org/archives.html)
# Élections partielles : "part2023-10-02", "part2025-03-17", etc.
elections <- c("gen2014-04-07", "gen2018-10-01", "gen2022-10-03")

# ---------------------------------------------------------------------
# 1. Résultats agrégés par circonscription et par candidat
#    (CSV encodés en ISO 8859-1, délimiteur « ; » précisé explicitement :
#    la détection automatique de readr plante sur les accents latin1)
# ---------------------------------------------------------------------
lire_csv_eq <- function(url) {
  read_delim(url, delim = ";", locale = locale(encoding = "latin1"),
             col_types = cols(.default = col_character()),
             show_col_types = FALSE)
}

agrege <- map(elections, function(id) {
  Sys.sleep(1)  # politesse envers le serveur
  list(
    candidats        = lire_csv_eq(file.path(base_arch, id, "candidats.csv")),
    circonscriptions = lire_csv_eq(file.path(base_arch, id, "circonscriptions.csv")),
    partis           = lire_csv_eq(file.path(base_arch, id, "partispolitiques.csv")),
    inscrits         = lire_csv_eq(file.path(base_arch, id, "electeur_inscrit.csv"))
  )
}) |> set_names(elections)

# ---------------------------------------------------------------------
# 2. Résultats par bureau de vote (un CSV par circonscription dans le zip)
#    Les fichiers sont conservés dans une liste : les colonnes de candidats
#    diffèrent d'une circonscription à l'autre. Inspecter avant de pivoter.
# ---------------------------------------------------------------------
telecharger_bv <- function(id) {
  dest <- file.path(racine, id)
  dir.create(dest, showWarnings = FALSE)
  zip <- file.path(dest, "resultats-bureau-vote.zip")
  if (!file.exists(zip)) {
    download.file(file.path(base_arch, id, "resultats-bureau-vote.zip"), zip, mode = "wb")
    Sys.sleep(1)
  }
  # Les noms de fichiers dans le zip sont encodés en CP850 (DOS) : on ne les
  # extrait pas sur le disque, on lit chaque CSV directement dans l'archive
  # par sa position, et on convertit les noms seulement pour étiqueter la liste.
  contenu <- archive::archive(zip)
  noms    <- iconv(contenu$path, from = "CP850", to = "UTF-8", sub = "?")
  noms[is.na(noms)] <- paste0("fichier_", which(is.na(noms)))
  idx     <- which(grepl("\\.csv$", noms, ignore.case = TRUE))
  map(idx, \(i) read_delim(archive::archive_read(zip, file = i), delim = ";",
                           locale = locale(encoding = "latin1"),
                           col_types = cols(.default = col_character()),
                           show_col_types = FALSE)) |>
    set_names(tools::file_path_sans_ext(basename(noms[idx])))
}

bureaux <- map(elections, telecharger_bv) |> set_names(elections)

# Aperçu de la structure d'un fichier
# glimpse(bureaux[["gen2022-10-03"]][[1]])

# ---------------------------------------------------------------------
# 3. Soirée électorale du 5 octobre 2026 : instantanés du fil en direct
#    Le fil est actualisé aux 2 à 5 minutes à partir de 20 h.
#    Chaque instantané est sauvegardé tel quel (JSON) avec un horodatage.
#    À lancer vers 19 h 55 le soir du scrutin, dans une session qui reste ouverte.
# ---------------------------------------------------------------------
collecter_soiree <- function(fin = as.POSIXct("2026-10-06 02:00", tz = "America/Montreal"),
                             intervalle = 300) {
  dest <- file.path(racine, "soiree_2026")
  dir.create(dest, recursive = TRUE, showWarnings = FALSE)
  while (Sys.time() < fin) {
    horo <- format(Sys.time(), "%Y%m%d-%H%M%S", tz = "America/Montreal")
    try(download.file(file.path(base_live, "resultats.json"),
                      file.path(dest, paste0("resultats_", horo, ".json")),
                      quiet = TRUE, mode = "wb"))
    Sys.sleep(intervalle)
  }
}

# collecter_soiree()