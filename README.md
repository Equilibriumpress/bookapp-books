# Bookapp Books

Public distribution repository for Bookapp publications.

This repository contains the static catalog consumed by the iOS app. EPUB binaries are published as GitHub Release assets.

## Catalog

`catalog.json` is the public index for released books. Each entry contains the book identifier, version, title, EPUB download URL, file size and SHA-256 checksum.

## Releases

Release tags follow this format:

`<book-slug>-v<content-version>`

Example:

`japanese-gardens-v1`

The release asset name follows:

`<book-slug>-v<content-version>.epub`

## Publishing

The publisher lives in `Equilibriumpress/bookapp/Publisher` and writes releases and catalog updates here.
