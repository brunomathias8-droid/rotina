#!/bin/sh
# Copia as regras de datas e rodízio para o servidor (o Apps Script não lê arquivos .js do repositório).
cd "$(dirname "$0")" && cp nucleo.js servidor/Nucleo.gs && echo "servidor/Nucleo.gs atualizado"
