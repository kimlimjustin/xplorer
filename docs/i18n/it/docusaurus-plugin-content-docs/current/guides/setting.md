# Impostazioni

<details>
<summary>
Come si fa per aprire le impostazioni?
</summary>
Puoi aprire le impostazioni su Xplorer facendo clic sul pulsante `Impostazioni` in basso a sinistra di Xplorer.

![Impostazioni](/img/docs/settings.webp)

</details> <details>
<summary>
Come si fa per uscire dalle impostazioni?
</summary>
È possibile uscire da Impostazioni su Xplorer cliccando sulla sinistra superiore di Xplorer.

![Impostazioni](/img/docs/exit-settings.webp)

</details>

## Aspetto

### Tema dell'app

È possibile modificare il tema dell'app di Xplorer sulla scheda `Aspetto` delle impostazioni. I temi predefiniti disponibili sono `light`, `light+`, `dark`, e `dark+`. Inoltre, c'è un tema `Predefinito di sistema` che leggerà automaticamente le preferenze di sistema, è possibile anche [provare i temi personalizzati](/docs/Extensions/theme/).

#### Applicare l'Effetto Ombra

| Con Effetto Ombra                              | Senza Effetto Ombra                                     |
| ---------------------------------------------- | ------------------------------------------------------- |
| ![Effetto Ombra](/img/docs/shadow-effect.webp) | ![Senza Effetto Ombra](/img/docs/no-shadow-effect.webp) |

Impostare l'effetto ombra dipendente dalla piattaforma alla finestra. Su Windows, non puoi disabilitare questo effetto quando usi lo [`Stile delle finestre predefinito` di sistema](#frame-style).

### Famiglia di font

È possibile modificare la famiglia di caratteri di Xplorer nella scheda `Aspetto` delle impostazioni con una delle famiglie di caratteri installate sul sistema.

### Dimensione del Carattere

È possibile modificare la dimensione del carattere di Xplorer nella scheda `Aspetto` delle Impostazioni. Si prega di notare che la dimensione del carattere ideale è compresa tra 10px e 30px.

### Trasparenza delle Finestre

È possibile rendere la finestra Xplorer trasparente nela scheda `Aspetto` delle impostazioni impostando le seguenti opzioni. Si prega di notare che la trasparenza ideale è compresa tra il 70% e il 100%. È possibile disabilitare la trasparenza disabilitando tutte le opzioni della trasparenza.

#### Barra Laterale Trasparente

Rendere la barra laterale trasparente ![Barra Laterale Trasparente](/img/docs/transparent-sidebar.webp)

#### Barra Superiore Trasparente

Rendere trasparente la barra superiore ![Barra Superiore Trasparente](/img/docs/transparent-topbar.webp)

#### Workspace Trasparente

Rendere il workspace trasparente ![Workspace Trasparente](/img/docs/transparent-workspace.webp)

#### Effetto Trasparente

È possibile aggiornare l'effetto di trasparenza sullo spazio di lavoro modificando il valore di trasparenza sull'opzione `Effetto di trasparenza` (dovrebbe funzionare solo su Windows 10). Effetti disponibili:

-   `Sfocatura` (un po 'lento quando si trascina)
-   `Acilico`(funziona solo su Windows 10 e versioni successive, ha anche cattive prestazioni durante il ridimensionamento/trascinamento della finestra)
-   `Vitalità` (funziona solo su macOS)
-   `Nessuno`(raccomandato) (È necessario riavviare l'app per tornare a nessuno)

### Stile Frame

È possibile scegliere lo stile del frame nella scheda `Aspetto` delle Impostazioni. Le opzioni disponibili sono `Predefinite` e `Predefinite di sistema`. `Predefinito` userà lo stile predefinito di Xplor che è lo stesso su tutte le piattaforme. `Predefinito di sistema` userà lo stile di frame predefinito del sistema, che è differente in base alla piattaforma utilizzata.

### Anteprima dei file

Anteprima del file qui potrebbe significare la miniatura del file.

#### Riproduci automaticamente il file video come miniatura

Questo riprodurrà automaticamente il file video come un'anteprima. :::caution QUESTO POTREBBE COBNSUMARE UNA GRANDE QUANTITÀ DI RAM
Questo potrebbe consumare una grande quantità di RAM perché è basato sul lettore video HTML.
È possibile abilitare questa impostazione e ignorare questa cautela se si dispone di un computer di ottime prestazioni.
:::

#### Anteprima immagine al passaggio con mouse

Questo riempimento mostra automaticamente l'immagine quando si passa sopar ad essa con il cursore del mouse per 500ms.

![Anteprima al passaggio con mouse](/img/docs/preview-on-hover.webp)

Alcune persone potrebbero trovarlo fastidioso ed è possibile disabilitarlo disabilitando questa impostazione.

#### Estrai l'icona del file exe e renderlo come la miniatura

Questo analizzerà e memorizzerà l'icona da un file `exe` e lo renderà un'anteprima. Solo su Windows.

![Estrai l'icona del file Exe](/img/docs/extract-exe-icon.webp)

:::warning Questo potrebbe causare un crash di Xplorer.

Questo perché Xplorer analizza l'icona dall'exe e se l'esadecimale del file exe è rotto, Xplorer si blocca.

Il modo per risolvere il problema è quello di disabilitare l'impostazione.

:::

:::info Open issue L'approccio corrente è chiamando il programma powershell che potrebbe far apparire delle finestre cmd.

Qualsiasi contributo per chiamarlo direttamente da Xplorer è benvenuto. :::

### Mostra immagine come miniatura

Questo mostrerà l'immagine come miniatura di un file. Si prega di notare che questo non è consigliato per directory di grandi dimensioni in quanto legge l'immagine sulla memoria.

### Layout di file predefinito

Layout predefinito del file di una directory. Provalo:)

### Area di lavoro

#### Mostra barra delle informazioni

Un'opzione per visualizzare la barra delle informazioni sullo spazio di lavoro. ![Barra delle informazioni di Xplorer](/img/docs/infobar.webp)

## Preferenze

### Lingua Dell'Applicazione

Traduci Xplorer. Aiutaci a tradurre Xplorer, [guarda questa discussione](https://github.com/kimlimjustin/xplorer/discussions/30).

### Nascondi file nascosti

Nascondi i file nascosti su Xplorer, puoi trovare questa impostazione nella scheda `Preferenze` su Xplorer o dalla sua scorciatoia, `Ctrl + H`.

### Nascondi File Di Sistema

Nascondi i file di sistema di Windows su Xplorer. :::tip Scopri cosa è il file di sistema [in questa pagina wikipedia](https://en.wikipedia.org/wiki/System_file). Basta disabilitaro se non si capisce cosa è. :::

### Elenca e ordina le directory insieme ai file

Se disabilitato, Xplorer darà la priorità alle directory sopra i file.

### Rileva Cambi di Unità

Attivando questa opzione verrà rilevato ogni cambiamento di unità e si aggiornerà la sezione della barra laterale e delle unità. Si prega di notare che questo prenderà grandi quantità di RAM in quanto questo non è ancora stabile.

### Cambia automaticamente il file di anteprima con il file selezionato

Abilitando questo cambierà automaticamente il file di anteprima con il file attualmente selezionato.

### Calcola la dimensione della sottocartella

Abilitare questa opzione ti aiuterà automaticamente a calcolare la dimensione delle sottocartelle ricorsivamente e mostrarla in vista dettagliata.

### Clic singolo/doppio per aprire un file

Abilitando questa opzione Xplorer aprirà un file con doppio clic. Altrimenti, aprirà un file con un singolo clic.

### All'avvio

Opzioni disponibili all'avvio di Xplorer. Le opzioni disponibili sono:

-   Nuova scheda
-   Riprendi la sessione precedente
