#!/usr/bin/env bash
# Which seed's art is approved for a glyph.
#
# Sourced by export.sh and diag.sh rather than written out in each, so that
# "the approved art" means one thing. A copy that drifts is not a cosmetic
# problem: diag.sh is the tool you judge alpha with, so pointing it at a seed
# that is not the shipped one hides exactly the defect it exists to find.
#
# Callers must have cd'd to this directory first; chosen.tsv is read by
# relative path, as it is everywhere else in the pipeline.
chosen_seed() {
  local want="$1" id seed
  while IFS=$'\t' read -r id seed; do
    if [ "$id" = "$want" ]; then
      echo "$seed"; return
    fi
  done < chosen.tsv
  echo 4
}
