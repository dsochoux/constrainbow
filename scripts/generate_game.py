import os
import random
import json
from datetime import datetime, timedelta

# number of colored tiles for each mode
MODES = {
    "speed": 10,
    "score": 9,
}

def game_path(mode, game_id):
    return f"games/{mode}/{game_id}.json"

def popcount(bits):
    # number of 1 bits in an int (int.bit_count needs Python 3.10+)
    return bits.bit_count() if hasattr(bits, "bit_count") else bin(bits).count("1")


class Game:
    words_path = "word_files/words.txt"

    word_length = 5
    alphabet = ('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's',
            't', 'u', 'v', 'w', 'x', 'y', 'z')

    letter_to_points = {
        'a': 1,
        'b': 3,
        'c': 3,
        'd': 2,
        'e': 1,
        'f': 4,
        'g': 2,
        'h': 4,
        'i': 1,
        'j': 8,
        'k': 5,
        'l': 1,
        'm': 3,
        'n': 1,
        'o': 1,
        'p': 3,
        'q': 10,
        'r': 1,
        's': 1,
        't': 1,
        'u': 1,
        'v': 4,
        'w': 4,
        'x': 8,
        'y': 4,
        'z': 10
    }

    thresholds = {
        "speed": 15000,
        "score": 50000
    }

    # the word index is shared by every Game and built once, the first time a Game is made
    # see docs/generation-algorithm.md for a full explanation
    words = None        # list of every accepted word; a word's position in this list is its "bit number"
    word_points = None  # word_points[i] is the point value of words[i]
    index = None        # index[position][letter] is a bitset of the words with that letter at that position
    all_words = None    # a bitset with a 1 for every word

    def __init__(self, date, mode, num_colored):

        self.game_id = date.strftime("%m%d%Y")
        self.mode = mode
        self.num_colored = num_colored

        self.constraints = [i + 1 for i in range(4)]
        self.constraint_assignments = ['' for _ in range(len(self.constraints))]
        self.set_vars()

        if Game.words is None:
            Game.build_index()

    @classmethod
    def build_index(cls):
        with open(cls.words_path, "r") as f:
            cls.words = [line.strip() for line in f if line.strip()]
        cls.word_points = [cls.calculate_points_for(word) for word in cls.words]
        cls.index = [{letter: 0 for letter in cls.alphabet} for _ in range(cls.word_length)]
        for i, word in enumerate(cls.words):
            for position, letter in enumerate(word):
                # turn on bit i in the bitset for (position, letter)
                cls.index[position][letter] |= 1 << i
        cls.all_words = (1 << len(cls.words)) - 1

    def set_vars(self):
        self.num_solutions = 0
        self.best_solution = {
            "points": 0,
            "word_1": "",
            "word_2": "",
            "word_3": "",
            "word_4": ""
        }
        self.grid = [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ]

    def generate_constraints(self):
        shuffled_constraints = random.sample(self.constraints, 4)
        guaranteed_constraints = []
        for i in range(len(self.constraints)):
            guaranteed_constraints.append([shuffled_constraints[i], shuffled_constraints[(i + 1) % 4]])

        for i in range(len(self.grid)):
            positions = random.sample(range(self.word_length), 2)
            self.grid[i][positions[0]] = guaranteed_constraints[i][0]
            self.grid[i][positions[1]] = guaranteed_constraints[i][1]
        total = 8
        # fill in the rest randomly
        _constraints = [i for i in range(1, len(self.constraints) + 1)]
        while total < self.num_colored:
            random_word = random.choice([i for i in range(0, len(self.grid))])
            random_position = random.choice([i for i in range(0, self.word_length)])
            if self.grid[random_word][random_position] != 0: continue
            random_constraint = random.choice(_constraints)
            _constraints.remove(random_constraint)
            self.grid[random_word][random_position] = random_constraint
            total += 1

    # returns a bitset of the words that fit a row of the grid with the current constraint assignments
    # every colored tile whose constraint has a letter must be that letter (constraints that
    # are not assigned yet are ignored)
    # if strict is True, every black tile must also NOT be any assigned constraint letter
    def matching_words(self, word, strict):
        bits = self.all_words
        for i, constraint in enumerate(word):
            if constraint == 0:
                if strict:
                    for letter in self.constraint_assignments:
                        # remove the words that have this constraint letter at this black position
                        bits &= ~self.index[i][letter]
            else:
                letter = self.constraint_assignments[constraint - 1]
                if letter != '':
                    # keep only the words with this letter at this position
                    bits &= self.index[i][letter]
            if bits == 0:
                break # nothing left, no point checking the other positions
        return bits

    # check to see if there are any potential solutions for the ith word in the words list
    # (black tiles are allowed to be anything here, which makes this a cheap early check)
    def is_solution_for(self, i):
        return self.matching_words(self.grid[i], strict=False) != 0

    @classmethod
    def calculate_points_for(cls, word):
        points = 0
        for letter in word:
            points += cls.letter_to_points[letter]
        return points

    # this function will be called when every constraint has a letter
    # here the wildcards are not allowed to be the same letter as one of the constraints
    def generate_solutions(self):
        num_solutions = 1 # base multiplication factor
        best_words = [None, None, None, None]
        best_points = [0, 0, 0, 0]
        for i, word in enumerate(self.grid):
            bits = self.matching_words(word, strict=True)
            if bits == 0:
                # there is no point in continuing, this constraint assignment has nothing for us
                return
            num_solutions *= popcount(bits)
            # walk through the 1 bits to find the highest scoring word for this row
            while bits:
                lowest_bit = bits & -bits
                w = lowest_bit.bit_length() - 1 # the word number of the lowest 1 bit
                if self.word_points[w] > best_points[i]:
                    best_points[i] = self.word_points[w]
                    best_words[i] = self.words[w]
                bits ^= lowest_bit # turn that bit off and move to the next one
        best_total_points = sum(best_points)
        if best_total_points > self.best_solution["points"]:
            self.best_solution["points"] = best_total_points
            self.best_solution["word_1"] = best_words[0]
            self.best_solution["word_2"] = best_words[1]
            self.best_solution["word_3"] = best_words[2]
            self.best_solution["word_4"] = best_words[3]
        # we will want to add the computed number of possibilites for this symbol arrangement to a total
        self.num_solutions += num_solutions

    def find_solution(self, constraint):
        if constraint == len(self.constraints) + 1:
            # at this point, we have assigned each symbol a letter
            # this assignment is promisng -- there are words that would satisfy the
            # constraints if the wildcard letters could by ANYTHING. However,
            # wildcards cannnot be the same letter as another symbol.
            # therefore, I must now check to make sure that for each word, there is a solution
            # where the wildcards are not the same as any of the symbols
            self.generate_solutions()
            return
        # symbol is an int pointing to the current symbol to be tried
        for letter in self.alphabet:
            # cannot re-use letters
            if letter in self.constraint_assignments: continue
            # assign letter to that symbol
            self.constraint_assignments[constraint - 1] = letter
            # check if there are solutions for all words
            solutions_exist = True
            for i in range(len(self.grid)):
                # we have not updated a constraint for this word, so there
                # is no reason to check if a valid one can be formed
                if constraint not in self.grid[i]: continue
                solutions_exist = solutions_exist and self.is_solution_for(i)
            # if there are, make a recursive call for the next symbol
            if solutions_exist:
                self.find_solution(constraint + 1)

            # otherwise, let the loop continue to the next letter
        # remove symbol from map before returning
        self.constraint_assignments[constraint - 1] = ''

    def generate(self):
        while self.num_solutions < self.thresholds[self.mode]:
            self.set_vars()
            result = {
            } # the result object that will be converted to JSON at the end
            self.generate_constraints()
            result["grid"] = self.grid

            # writing constraints in useful format for the front end
            result["constraints"] = [[] for _ in range(len(self.constraints) + 1)]
            for i in range(len(self.grid)):
                for j in range(len(self.grid[i])):
                    result["constraints"][self.grid[i][j]].append([i, j])

            self.find_solution(1)

        result["num_possible_solutions"] = self.num_solutions
        result["num_possible_points"] = self.best_solution["points"]
        result["best_solution"] = self.best_solution

        output_file = game_path(self.mode, self.game_id)
        # write to a temporary file, then rename it into place, so the web server
        # can never read a half-written game file
        temp_file = output_file + ".tmp"
        with open(temp_file, "w") as f:
            json.dump(result, f, indent=4)
        os.replace(temp_file, output_file)


def generate_day(date):
    for mode, num_colored in MODES.items():
        Game(date, mode, num_colored).generate()


if __name__ == "__main__":
    start_date = datetime(2026, 11, 1)
    end_date = datetime(2026, 11, 30)

    # loop through all the dates in the range
    for i in range((end_date - start_date).days + 1):
        date = start_date + timedelta(days=i)
        print(f"Generating games for {date.strftime('%m/%d/%Y')}")
        generate_day(date)
