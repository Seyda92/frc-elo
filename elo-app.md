
Ich möchte eine ELO System für unseren Sportverein.
Wir sind ein Lustiger Verein der sich nicht zu ernst nimmt.

# Infrastruktur
Die App muss so sein, dass die Hauptapp in der Cloude gehostet wird in einem Docker. 
Wir müssen die App aber auch auf einem Raspberry Pi laufen lassen, da spiele oft dort ausgetragen werden, wo es keinen Empfang gibt. 
Der Raspberry muss die Änderungen der Datenbank, dann an die App in der Cloude Synchronisieren. 
Der Raspberry soll die App im lokalen Netzwerk unter frc.elo bereitstellen.

Nun zu den Funktionen

# Login
Wir brauchen einen einfachen Login mit 2 Rollen (Admin und User)

# Administrativ
- Admins müssen Spieler hinzufügen können
- Admins müssen Vereine anlegen können
- Admins müssen geplante Spiele eintragen können mit Uhrzeit
- Admins müssen die ergebnisse von Spielen festhalten können
- Spieltage / Event anlegen (ein "Spieltag" kann ein ganzes Wochenende gehen)
- Admins müssen komplette Spiele nachtragen können auch wenn sie vorher nicht geplant wurden


# Spiele
- Spiele bestehen aus 2 Teams 
- Jedes Team hat 3-5 Spieler wobei die Teams gleich viele Spieler brauchen
- Es gibt nur gewonnen oder verloren, keine Punkte
- Zusätzlich gibt es extra statistiken zu nach jedem Spiel zu jedem Spieler
- Diese Statistiken beinhalten die Anzahl der Bonusbiere und Trefferquote (hier soll die anzahl der würfe und die anzahl der treffer eingetragen werden können) 


# Spieler
Jeder Spieler hat
- einen Namen, 
- eine Rückennummer 
- einen Elowert
- eine Trefferquote
- Anzahl der Bonusbiere
- einen Verein

# Verein
Der Verein soll einfach nur allgemeine Informationen zum Verein haben
- Name
- Ort

# Nutzer
Also normaler Nutzer der Anwendung will ich folgende informationen angezeigt bekommen:
- Leaderboard mit informationen zu elo, Trefferquote, bonusbier, ingesamt gespielte runden, gewonnen runden und verlorene Runden
- Eine übersicht der letzten gespielten Spiele
- Eine Übersicht der geplanten Spiele
- Eine Übersicht der letzten und geplanten events
- Wenn ich auf einen Spieler in den Leaderboards clicke will ich eine coole übersicht zu den statistiken dieses Spielers haben
- Eine übersicht zu den Verienen (momentan gibt es eh nur einen aber das soll vorbereitet werden falls es irgendwann mehr vereine gibt)


