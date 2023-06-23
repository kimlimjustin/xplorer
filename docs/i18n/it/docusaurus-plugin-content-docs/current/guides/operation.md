# Operazioni

## Copia di file

È possibile copiare i file facendo clic con il tasto destro del mouse e facendo clic sull'opzione `Copia` o selezionare il file quindi premendo `Ctrl + C` come scorciatoia e incollarlo facendo clic sull'opzione `Incolla` o premendo `Ctrl + V` sulla cartella di destinazione.

:::info

Per l'implementazione attuale, Xplorer scrive cosa copiare localmente (senza copiare negli appunti).

DA FARE: implementare copia negli appunti

:::

## Copiare il percorso di una cartella

È possibile copiare il percorso di un file/cartella negli appunti facendo clic con il tasto destro del mouse e poi su `Copia percorso posizione` o selezionando il file e poi premendo `Alt + Maiusc + C` come scorciatoia.

## Tagliare file

È possibile tagliare i file facendo clic con il tasto destro del mouse e facendo clic sull'opzione `Taglia` o selezionare il file quindi premendo `Ctrl + X` come scorciatoia e incollarlo facendo clic sull'opzione `Incolla` o premendo `Ctrl + V` sulla cartella di destinazione.

:::info

Per l'implementazione attuale, Xplorer scrive cosa tagliare localmente (senza copiare negli appunti).

:::

## Eliminazione di file

È possibile eliminare i file facendo clic con il tasto destro del mouse e fare clic sull'opzione `Elimina` o selezionare il file e poi premere `Canc` come scorciatoia.

### File nel cestino

Il file nel cestino sono accessibili nella cartella `xplorer://Trash` o nella cartella cestino di sistema. :::danger Problema Aperto

Si prega di notare che la cartella Cestino non può essere accessibile su macos tramite Xplorer dal momento che la [cartella Cestino](https://github.com/Byron/trash-rs) alla quale Xplorer si affida non è supportata (vedi [questo problema](https://github.com/Byron/trash-rs/issues/8) per maggiori dettagli).

Tutti i contributi relativi alla cartella Cestino o a Xplorer stesso per questo argomento sono benvenuti. :::

### Ripristinare i file

È possibile ripristinare i file aprendo il `xplorer://Cestino` e facendo clic destro su di esso e fare clic sull'opzione `Ripristina`

### Eliminazione definitiva

:::danger Non è possibile ripristinare un file eliminato definitivamente. Si prega di controllare nuovamente prima di eliminare definitivamente qualsiasi file.

:::

È possibile eliminare definitivamente un file nel seguente modo:

1. Eliminarlo in `Trash` e fare clic con il pulsante destro del mouse e poi sull'opzione `Elimina definitivamente`
2. Selezionare il file e premere `Maiusc + Canc` come scorciatoia

## Ricerca di file

Xplorer utilizza [`glob patterns`](https://en.wikipedia.org/wiki/Glob_(programming)) per cercare i file corrispondenti. [Scopri la sintassi di Glob patterns](https://en.wikipedia.org/wiki/Glob_(programming)). Per iniziare, premere `Ctrl + F` e digitare all'interno della casella di ricerca.

### Ricerca istantanea

È possibile cercare istantaneamente un file/cartella digitando i caratteri iniziali del nome del file/cartella e Xplorer selezionerà il file per voi. Alcune regole per la ricerca istantanea:

-   Qualsiasi segno diacritico inglese viene rimosso
-   L'intervallo per la ricerca istantanea è 750ms. Dopo 750ms, la query di ricerca verrà resettata.
-   Digitare lo stesso carattere farà in modo che Xplorer trovi le prossime corrispondenze.

## Novità

:::caution Fai attenzione con il nome del nuovo file/cartella Xplorer tratta `/` nel nome del file/cartella come sotto-cartella/sotto-file :::

### Nuovo file

È possibile creare un nuovo file facendo clic con il pulsante destro del mouse sullo spazio di lavoro, espandi l'opzione `Nuovo` e selezionando l'opzione `file`, o premendo `Alt + N` come scorciatoia.

### Nuova cartella

È possibile creare una nuova cartella facendo clic con il pulsante destro del mouse sullo spazio di lavoro, espandi l'opzione `Nuovo` e selezionando l'opzione `cartella`, o premendo `Maiusc + N` come scorciatoia.

## Apertura di un file

È possibile aprire un file sull'applicazione predefinita facendo doppio clic su di esso o selezionare il file e poi premendo `Invio` come scorciatoia.

### Apertura nel terminale

Questa è una funzione integrata di Xplorer. È possibile aprire una cartella sul terminale facendo clic con il tasto destro del mouse e poi facendo clic sull'opzione `Apri nel terminale` o selezionando la cartella e poi premendo `Alt + T` come scorciatoia.

### Apertura in VSCode

Questa è una funzione integrata di Xplorer. È possibile aprire un file/cartella in VSCode facendo clic con il tasto destro del mouse e poi facendo clic sull'opzione `Apri in vscode` o selezionando la cartella e poi premendo `Ctrl + Invio` come scorciatoia. Non potrai farlo se non hai installato VSCode.

## Fissa sulla barra laterale

È possibile fissare un file/cartella sulla barra laterale facendo clic con il tasto destro del mouse e fare clic su `Fissa sulla barra laterale` o selezionare il file quindi premere `Alt + P` come scorciatoia.

## Anteprima dei file

È possibile visualizzare in anteprima un file direttamente da Xplorer facendo clic con il tasto destro del mouse e facendo clic sull'opzione `Anteprima` o selezionando il file e poi premendo `Ctrl+O`.

![Demo di anteprima](/img/docs/preview.webp)

:::info

<details>
<summary>
File attualmente disponibili per l'anteprima:
</summary>

* File Markdown
* File di immagini
* File di testo
* File video
* Pdf
* Quasi tutti i linguaggi di programmazione con evidenziazione della sintassi

</details>

:::

## Proprietà

È possibile visualizzare le proprietà di un file/cartella facendo clic con il tasto destro del mouse e facendo clic su `Proprietà` o selezionando il file e poi premendo `Ctrl + P` come scorciatoia. Proprietà disponibili per ora (verranno migliorate alla prossima versione):

-   Dimensione
-   Percorso del file
-   Data di creazione
-   Ultimo accesso
-   Ultima modifica
-   È Nascosto

## Rinomina di un file/cartella

È possibile rinominare un file/cartella facendo clic con il tasto destro del mouse e facendo clic sull'opzione `Rinomina` o selezionando il file e poi premendo `F2` come scorciatoia. Verrà visualizzata una finestra di dialogo, immettere il nuovo nome e il file/cartella verrà rinominato.
