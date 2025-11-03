class TournamentManager {
    constructor() {
        this.tournament = null;
        this.currentMatch = null;
        this.pendingResetType = null;
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.bindEvents();
        this.initReset();
        this.updatePlayersInputs();
    }

    bindEvents() {
        // Setup phase
        document.getElementById('teamsCount').addEventListener('change', () => this.updatePlayersInputs());
        document.getElementById('startTournament').addEventListener('click', () => this.startTournament());
        
        // League phase
        document.getElementById('generateSchedule').addEventListener('click', () => this.generateSchedule());
        document.getElementById('proceedToKnockout').addEventListener('click', () => this.proceedToKnockout());
        
        // Knockout phase
        document.getElementById('backToLeague').addEventListener('click', () => this.showPhase('leaguePhase'));
        
        // Modal
        document.getElementById('saveResult').addEventListener('click', () => this.saveMatchResult());
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('matchModal')) {
                this.closeModal();
            }
        });
    }

    // Reset functionality
    initReset() {
        document.getElementById('resetTournament').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleResetOptions();
        });

        // Close reset options when clicking elsewhere
        document.addEventListener('click', () => {
            this.hideResetOptions();
        });

        // Add event listeners to reset options
        document.querySelectorAll('.reset-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const resetType = e.target.dataset.resetType;
                this.showConfirmation(resetType);
            });
        });

        // Confirmation modal events
        document.getElementById('confirmResetYes').addEventListener('click', () => {
            this.executeReset(this.pendingResetType);
            this.hideConfirmation();
        });

        document.getElementById('confirmResetNo').addEventListener('click', () => {
            this.hideConfirmation();
        });
    }

    toggleResetOptions() {
        const options = document.getElementById('resetOptions');
        options.classList.toggle('show');
    }

    hideResetOptions() {
        const options = document.getElementById('resetOptions');
        options.classList.remove('show');
    }

    showConfirmation(resetType) {
        this.pendingResetType = resetType;
        const modal = document.getElementById('confirmationModal');
        const message = document.getElementById('confirmationMessage');
        
        const messages = {
            full: 'Are you sure you want to completely reset the tournament? All data will be lost and you\'ll start from scratch.',
            league: 'Are you sure you want to reset the league phase? This will clear all league matches and standings.',
            knockout: 'Are you sure you want to reset the knockout phase? This will clear all knockout matches and brackets.',
            results: 'Are you sure you want to reset all match results? This will clear all scores but keep the schedule.'
        };

        message.textContent = messages[resetType] || 'Are you sure you want to reset?';
        modal.style.display = 'block';
        this.hideResetOptions();
    }

    hideConfirmation() {
        const modal = document.getElementById('confirmationModal');
        modal.style.display = 'none';
        this.pendingResetType = null;
    }

    executeReset(resetType) {
        if (!this.tournament && resetType !== 'full') return;

        switch (resetType) {
            case 'full':
                this.fullReset();
                break;
            case 'league':
                this.resetLeaguePhase();
                break;
            case 'knockout':
                this.resetKnockoutPhase();
                break;
            case 'results':
                this.resetMatchResults();
                break;
        }

        this.saveToStorage();
    }

    fullReset() {
        localStorage.removeItem('fifaTournament');
        this.tournament = null;
        
        // Clear all form inputs
        document.getElementById('tournamentName').value = '';
        document.getElementById('teamsCount').value = '8';
        document.getElementById('gamesPerTeam').value = '4';
        document.getElementById('teamsAdvancing').value = '4';
        
        this.updatePlayersInputs();
        this.showPhase('setupPhase');
    }

    resetLeaguePhase() {
        if (this.tournament) {
            this.tournament.matches = [];
            this.tournament.standings = [];
            this.tournament.phase = 'league';
            this.renderMatches();
            this.renderStandings();
        }
    }

    resetKnockoutPhase() {
        if (this.tournament && this.tournament.phase === 'knockout') {
            this.tournament.playoffMatches = [];
            this.tournament.knockoutMatches = [];
            this.tournament.phase = 'league';
            this.showPhase('leaguePhase');
            this.renderKnockoutBracket();
        }
    }

    resetMatchResults() {
        if (this.tournament) {
            // Reset league match results
            this.tournament.matches.forEach(match => {
                match.homeScore = null;
                match.awayScore = null;
                match.played = false;
            });

            // Reset knockout match results
            if (this.tournament.playoffMatches) {
                this.tournament.playoffMatches.forEach(match => {
                    match.homeScore = null;
                    match.awayScore = null;
                    match.played = false;
                    match.winner = null;
                });
            }

            if (this.tournament.knockoutMatches) {
                this.tournament.knockoutMatches.forEach(match => {
                    if (match.away !== null) { // Don't reset byes
                        match.homeScore = null;
                        match.awayScore = null;
                        match.played = false;
                        match.winner = null;
                    }
                });
            }

            this.updateStandings();
            this.renderMatches();
            this.renderStandings();
            
            if (this.tournament.phase === 'knockout') {
                this.renderKnockoutBracket();
            }
        }
    }

    updatePlayersInputs() {
        const teamsCount = parseInt(document.getElementById('teamsCount').value);
        const container = document.querySelector('.player-inputs');
        container.innerHTML = '';

        for (let i = 0; i < teamsCount; i++) {
            const playerHtml = `
                <div class="player-input">
                    <input type="text" class="player-name" placeholder="Player ${i + 1} Name" data-index="${i}">
                    <input type="text" class="player-team" placeholder="Team ${i + 1}" data-index="${i}">
                </div>
            `;
            container.innerHTML += playerHtml;
        }
    }

    startTournament() {
        const tournamentName = document.getElementById('tournamentName').value || 'FIFA Tournament';
        const teamsCount = parseInt(document.getElementById('teamsCount').value);
        const gamesPerTeam = parseInt(document.getElementById('gamesPerTeam').value);
        const teamsAdvancing = parseInt(document.getElementById('teamsAdvancing').value);

        // Validate inputs
        if (teamsAdvancing > teamsCount) {
            alert('Teams advancing cannot be greater than total teams!');
            return;
        }

        // Get players data
        const players = [];
        const playerInputs = document.querySelectorAll('.player-input');
        
        playerInputs.forEach((input, index) => {
            const name = input.querySelector('.player-name').value || `Player ${index + 1}`;
            const team = input.querySelector('.player-team').value || `Team ${index + 1}`;
            players.push({ name, team });
        });

        // Initialize tournament
        this.tournament = {
            name: tournamentName,
            teamsCount,
            gamesPerTeam,
            teamsAdvancing,
            players,
            matches: [],
            standings: [],
            phase: 'league',
            playoffMatches: [],
            knockoutMatches: []
        };

        this.saveToStorage();
        this.showPhase('leaguePhase');
        this.generateSchedule();
    }

    generateSchedule() {
        if (!this.tournament) return;

        const { players, gamesPerTeam } = this.tournament;
        const matches = [];
        const playedPairs = new Set();

        // Generate random matchups
        players.forEach((homePlayer, homeIndex) => {
            let gamesScheduled = 0;
            
            while (gamesScheduled < gamesPerTeam) {
                const awayIndex = Math.floor(Math.random() * players.length);
                
                // Skip if same player or matchup already exists
                if (homeIndex === awayIndex) continue;
                
                const matchKey = `${Math.min(homeIndex, awayIndex)}-${Math.max(homeIndex, awayIndex)}`;
                if (playedPairs.has(matchKey)) continue;

                matches.push({
                    id: matches.length + 1,
                    home: homePlayer.name,
                    away: players[awayIndex].name,
                    homeScore: null,
                    awayScore: null,
                    played: false
                });

                playedPairs.add(matchKey);
                gamesScheduled++;
                
                // Break if we can't schedule more games
                if (gamesScheduled >= gamesPerTeam) break;
            }
        });

        this.tournament.matches = matches;
        this.updateStandings();
        this.saveToStorage();
        this.renderMatches();
        this.renderStandings();
    }

    updateStandings() {
        if (!this.tournament) return;

        const { players, matches } = this.tournament;
        const standings = players.map(player => ({
            player: player.name,
            team: player.team,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0
        }));

        // Calculate standings from matches
        matches.forEach(match => {
            if (!match.played) return;

            const homeStanding = standings.find(s => s.player === match.home);
            const awayStanding = standings.find(s => s.player === match.away);

            if (homeStanding && awayStanding) {
                homeStanding.played++;
                awayStanding.played++;
                
                homeStanding.goalsFor += match.homeScore;
                homeStanding.goalsAgainst += match.awayScore;
                awayStanding.goalsFor += match.awayScore;
                awayStanding.goalsAgainst += match.homeScore;

                if (match.homeScore > match.awayScore) {
                    homeStanding.won++;
                    homeStanding.points += 3;
                    awayStanding.lost++;
                } else if (match.homeScore < match.awayScore) {
                    awayStanding.won++;
                    awayStanding.points += 3;
                    homeStanding.lost++;
                } else {
                    homeStanding.drawn++;
                    awayStanding.drawn++;
                    homeStanding.points += 1;
                    awayStanding.points += 1;
                }
            }
        });

        // Calculate goal difference and sort
        standings.forEach(standing => {
            standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
        });

        // Sort by points, GD, goals scored, head-to-head
        standings.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
            
            // Simple head-to-head comparison (could be enhanced)
            const headToHead = this.getHeadToHead(a.player, b.player);
            return headToHead;
        });

        this.tournament.standings = standings;
    }

    getHeadToHead(playerA, playerB) {
        const match = this.tournament.matches.find(m => 
            ((m.home === playerA && m.away === playerB) || 
             (m.home === playerB && m.away === playerA)) && m.played
        );

        if (!match) return 0;

        const aIsHome = match.home === playerA;
        const aScore = aIsHome ? match.homeScore : match.awayScore;
        const bScore = aIsHome ? match.awayScore : match.homeScore;

        return bScore - aScore; // Positive if A won, negative if B won
    }

    renderStandings() {
        const container = document.getElementById('standingsTable');
        const { standings, teamsAdvancing, teamsCount } = this.tournament;

        // Calculate qualification zones
        const traditionalNumbers = [4, 8, 16, 32];
        let automaticSpots, playoffSpots, riskSpots;

        if (traditionalNumbers.includes(teamsAdvancing)) {
            // All qualifying spots are automatic for traditional numbers
            automaticSpots = teamsAdvancing;
            playoffSpots = 0;
        } else {
            // Calculate automatic vs playoff spots for non-traditional numbers
            const nextLowerTraditional = traditionalNumbers
                .filter(num => num < teamsAdvancing)
                .reduce((max, num) => Math.max(max, num), 0);
            
            playoffSpots = teamsAdvancing - nextLowerTraditional;
            automaticSpots = teamsAdvancing - playoffSpots;
        }

        // Calculate at-risk spots (teams that don't qualify)
        riskSpots = teamsCount - teamsAdvancing;

        // Create legend HTML
        const legendHtml = `
            <div class="qualification-legend">
                <div class="legend-title">Qualification Zones</div>
                <div class="legend-items">
                    <div class="legend-item">
                        <div class="legend-color legend-automatic"></div>
                        <span>Automatic Qualification (Top ${automaticSpots})</span>
                    </div>
                    ${playoffSpots > 0 ? `
                    <div class="legend-item">
                        <div class="legend-color legend-playoff"></div>
                        <span>Playoff Positions (Next ${playoffSpots})</span>
                    </div>
                    ` : ''}
                    <div class="legend-item">
                        <div class="legend-color legend-risk"></div>
                        <span>At Risk (Bottom ${riskSpots})</span>
                    </div>
                </div>
            </div>
        `;

        let html = legendHtml + `
            <table>
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Player</th>
                        <th>Team</th>
                        <th>P</th>
                        <th>W</th>
                        <th>D</th>
                        <th>L</th>
                        <th>GF</th>
                        <th>GA</th>
                        <th>GD</th>
                        <th>Pts</th>
                    </tr>
                </thead>
                <tbody>
        `;

        standings.forEach((standing, index) => {
            let qualificationClass = '';
            
            // Determine qualification zone
            if (index < automaticSpots) {
                qualificationClass = 'qualification-automatic';
            } else if (index < teamsAdvancing) {
                qualificationClass = 'qualification-playoff';
            } else if (index >= teamsCount - riskSpots) {
                qualificationClass = 'qualification-risk';
            }
            
            html += `
                <tr>
                    <td class="${qualificationClass}">${index + 1}</td>
                    <td class="${qualificationClass}">${standing.player}</td>
                    <td class="${qualificationClass}">${standing.team}</td>
                    <td class="${qualificationClass}">${standing.played}</td>
                    <td class="${qualificationClass}">${standing.won}</td>
                    <td class="${qualificationClass}">${standing.drawn}</td>
                    <td class="${qualificationClass}">${standing.lost}</td>
                    <td class="${qualificationClass}">${standing.goalsFor}</td>
                    <td class="${qualificationClass}">${standing.goalsAgainst}</td>
                    <td class="${qualificationClass}">${standing.goalDifference}</td>
                    <td class="${qualificationClass}"><strong>${standing.points}</strong></td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

        // Enable proceed button if all matches are played
        const allMatchesPlayed = this.tournament.matches.every(match => match.played);
        document.getElementById('proceedToKnockout').disabled = !allMatchesPlayed;
    }

    renderMatches() {
        const container = document.getElementById('matchesContainer');
        const { matches } = this.tournament;

        let html = '';

        matches.forEach(match => {
            const statusClass = match.played ? 'played' : '';
            const statusText = match.played ? 'Played' : 'Pending';
            const score = match.played ? `${match.homeScore} - ${match.awayScore}` : 'VS';
            
            html += `
                <div class="match-card ${statusClass}" data-match-id="${match.id}">
                    <div class="match-teams">
                        <strong>${match.home}</strong> ${score} <strong>${match.away}</strong>
                    </div>
                    <div class="match-status ${match.played ? 'match-played' : 'match-pending'}">
                        ${statusText}
                    </div>
                    ${!match.played ? '<button class="btn btn-primary enter-result">Enter Result</button>' : ''}
                </div>
            `;
        });

        container.innerHTML = html;

        // Add event listeners to enter result buttons
        document.querySelectorAll('.enter-result').forEach(button => {
            button.addEventListener('click', (e) => {
                const matchId = parseInt(e.target.closest('.match-card').dataset.matchId);
                this.openMatchModal(matchId);
            });
        });
    }

    openMatchModal(matchId) {
        const match = this.tournament.matches.find(m => m.id === matchId);
        if (!match) return;

        this.currentMatch = match;
        
        document.getElementById('matchDetails').innerHTML = `
            <p><strong>${match.home}</strong> vs <strong>${match.away}</strong></p>
        `;
        
        document.getElementById('homeScore').value = '';
        document.getElementById('awayScore').value = '';
        
        document.getElementById('matchModal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('matchModal').style.display = 'none';
        this.currentMatch = null;
    }

    saveMatchResult() {
        if (!this.currentMatch) return;

        const homeScore = parseInt(document.getElementById('homeScore').value);
        const awayScore = parseInt(document.getElementById('awayScore').value);

        if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
            alert('Please enter valid scores!');
            return;
        }

        this.currentMatch.homeScore = homeScore;
        this.currentMatch.awayScore = awayScore;
        this.currentMatch.played = true;

        this.updateStandings();
        this.saveToStorage();
        this.renderMatches();
        this.renderStandings();
        this.closeModal();
    }

    proceedToKnockout() {
        this.tournament.phase = 'knockout';
        this.generateKnockoutBracket();
        this.saveToStorage();
        this.showPhase('knockoutPhase');
    }

    generateKnockoutBracket() {
        const { standings, teamsAdvancing } = this.tournament;
        const qualifyingTeams = standings.slice(0, teamsAdvancing).map(s => s.player);

        // Determine bracket structure
        const traditionalNumbers = [4, 8, 16, 32];
        let playoffMatches = [];
        let mainBracketTeams = qualifyingTeams;

        if (!traditionalNumbers.includes(teamsAdvancing)) {
            // Generate playoff matches to reduce to next traditional number
            const nextLowerTraditional = traditionalNumbers
                .filter(num => num < teamsAdvancing)
                .reduce((max, num) => Math.max(max, num), 0);
            
            const playoffSpots = teamsAdvancing - nextLowerTraditional;
            const playoffTeams = qualifyingTeams.slice(-playoffSpots * 2);
            mainBracketTeams = qualifyingTeams.slice(0, qualifyingTeams.length - playoffTeams.length);

            // Create playoff matches
            for (let i = 0; i < playoffTeams.length; i += 2) {
                if (i + 1 < playoffTeams.length) {
                    playoffMatches.push({
                        round: 'Playoff',
                        home: playoffTeams[i],
                        away: playoffTeams[i + 1],
                        homeScore: null,
                        awayScore: null,
                        played: false,
                        winner: null
                    });
                }
            }
        }

        // Generate main knockout bracket
        const knockoutMatches = this.generateKnockoutMatches(mainBracketTeams);

        this.tournament.playoffMatches = playoffMatches;
        this.tournament.knockoutMatches = knockoutMatches;
    }

    generateKnockoutMatches(teams) {
        const matches = [];
        let roundTeams = [...teams];
        let roundNumber = 1;

        while (roundTeams.length > 1) {
            const roundName = this.getRoundName(roundTeams.length);
            const roundMatches = [];

            for (let i = 0; i < roundTeams.length; i += 2) {
                if (i + 1 < roundTeams.length) {
                    roundMatches.push({
                        round: roundName,
                        home: roundTeams[i],
                        away: roundTeams[i + 1],
                        homeScore: null,
                        awayScore: null,
                        played: false,
                        winner: null
                    });
                } else {
                    // Handle bye (odd number of teams)
                    roundMatches.push({
                        round: roundName,
                        home: roundTeams[i],
                        away: null,
                        homeScore: null,
                        awayScore: null,
                        played: true,
                        winner: roundTeams[i]
                    });
                }
            }

            matches.push(...roundMatches);
            
            // Prepare for next round (winners advance)
            roundTeams = roundMatches.map(match => match.winner || `Winner of ${match.home} vs ${match.away}`);
            roundNumber++;
        }

        return matches;
    }

    getRoundName(teamCount) {
        switch (teamCount) {
            case 2: return 'Final';
            case 4: return 'Semi Finals';
            case 8: return 'Quarter Finals';
            default: return `Round of ${teamCount}`;
        }
    }

    renderKnockoutBracket() {
        const playoffContainer = document.getElementById('playoffRound');
        const bracketContainer = document.getElementById('mainBracket');

        // Render playoff matches if any
        if (this.tournament.playoffMatches.length > 0) {
            let playoffHtml = '<h3>Playoff Round</h3>';
            this.tournament.playoffMatches.forEach((match, index) => {
                playoffHtml += this.renderKnockoutMatch(match, index);
            });
            playoffContainer.innerHTML = playoffHtml;
        } else {
            playoffContainer.innerHTML = '';
        }

        // Render main bracket
        let bracketHtml = '<h3>Knockout Bracket</h3>';
        const rounds = [...new Set(this.tournament.knockoutMatches.map(m => m.round))];
        
        rounds.forEach(round => {
            bracketHtml += `<div class="bracket-round"><h4>${round}</h4>`;
            const roundMatches = this.tournament.knockoutMatches.filter(m => m.round === round);
            
            roundMatches.forEach((match, index) => {
                bracketHtml += this.renderKnockoutMatch(match, index);
            });
            
            bracketHtml += '</div>';
        });

        bracketContainer.innerHTML = bracketHtml;
    }

    renderKnockoutMatch(match, index) {
        const statusClass = match.played ? 'played' : '';
        const score = match.played ? 
            (match.away ? `${match.homeScore} - ${match.awayScore}` : 'BYE') : 
            'VS';
        
        return `
            <div class="bracket-match ${statusClass}" data-match-index="${index}">
                <div class="match-teams">
                    <strong>${match.home}</strong> ${score} 
                    ${match.away ? `<strong>${match.away}</strong>` : ''}
                </div>
                ${match.played ? 
                    `<div class="match-winner">Winner: ${match.winner}</div>` : 
                    '<button class="btn btn-primary enter-knockout-result">Enter Result</button>'
                }
            </div>
        `;
    }

    showPhase(phaseId) {
        // Hide all phases
        document.querySelectorAll('.phase').forEach(phase => {
            phase.classList.remove('active');
        });

        // Show selected phase
        document.getElementById(phaseId).classList.add('active');

        // Update content based on phase
        if (phaseId === 'knockoutPhase') {
            this.renderKnockoutBracket();
        }
    }

    saveToStorage() {
        if (this.tournament) {
            localStorage.setItem('fifaTournament', JSON.stringify(this.tournament));
        }
    }

    loadFromStorage() {
        const saved = localStorage.getItem('fifaTournament');
        if (saved) {
            this.tournament = JSON.parse(saved);
            
            // Show appropriate phase
            this.showPhase(this.tournament.phase + 'Phase');
            
            // Render content
            if (this.tournament.phase === 'league') {
                this.renderMatches();
                this.renderStandings();
            } else {
                this.renderKnockoutBracket();
            }
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TournamentManager();
});