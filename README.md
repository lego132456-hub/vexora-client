# Vexora Client (mod Fabric, Minecraft 1.21.4)

Wbudowane w grę menu w stylu Lunara. Prawy Shift otwiera menu, w którym włączasz/wyłączasz moduły HUD:
FPS, CPS, klawisze (WASD), zbroja z wytrzymałością, koordynaty, ping, efekty, auto sprint.
Ustawienia zapisują się w `config/vexora.properties`.

## Budowanie (najłatwiej, bez instalowania czegokolwiek)
1. Załóż darmowe konto na github.com i nowe repozytorium, wgraj do niego całą zawartość tego folderu.
2. Wejdź w zakładkę **Actions**, poczekaj aż zielony znaczek się pojawi (około 2 min).
3. Otwórz ostatni przebieg i pobierz artefakt **vexora-client** – w środku jest plik `vexora-client-1.0.0.jar`.
4. Zmień nazwę na `vexora-client-1.21.4.jar` i wrzuć do launchera: `assets/client/`.

## Budowanie lokalnie
JDK 21 + Gradle 8.12:  `gradle build`  → `build/libs/vexora-client-1.0.0.jar`

## Uwagi
- Kod nie był kompilowany ani testowany przy pisaniu. Jeśli build zgłosi błąd, wklej go do rozmowy, a poprawimy.
- Numery wersji w `gradle.properties` (yarn, loader, Fabric API) sprawdź na https://fabricmc.net/develop
- Na inną wersję Minecrafta trzeba zmienić numery i ewentualnie drobne nazwy w API.
