import sqlite3
import time

db_path = "database.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# cursor.execute('''
# SELECT w1.first_letter, w1.second_letter, w1.third_letter, w1.fourth_letter, w1.fifth_letter
# FROM words w1
# JOIN words w2 ON w2.fifth_letter = w1.fifth_letter
# JOIN words w3 ON w3.fourth_letter = w2.fifth_letter AND w3.second_letter = w1.fourth_letter
# JOIN words w4 ON w4.first_letter = w1.fourth_letter;
# ''')

# start_time = time.time()
# cursor.execute('''
# SELECT w1.first_letter, w1.second_letter, w1.third_letter, w1.fourth_letter, w1.fifth_letter, w2.first_letter, w2.second_letter, w2.third_letter, w2.fourth_letter, w2.fifth_letter, w3.first_letter, w3.second_letter, w3.third_letter, w3.fourth_letter, w3.fifth_letter
# FROM words w1
# JOIN words w2 ON w2.fifth_letter = w1.fifth_letter
# JOIN words w3 ON w3.fourth_letter = w2.fifth_letter AND w3.second_letter = w1.fourth_letter
# ''')

# words = cursor.fetchall()
# time_msg = f"Execution time: {time.time() - start_time}"
# print(len(words))
# print(time_msg)

# for word in words[:1]:
#     print("".join(word[:5]), "".join(word[5:10]), "".join(word[10:15]), "".join(word[15:]))


# the goal: get a set of four words where the size of their intersection is 10

# select 4 random numbers in range [1, 2309]
import random


def get_four_random_words():
    indecies_of_words = random.sample(range(1, 2310), 4)
    cursor.execute('''
    SELECT first_letter, second_letter, third_letter, fourth_letter, fifth_letter
    FROM words
    WHERE id IN (?, ?, ?, ?)
    ''', indecies_of_words)
    fetched_words = cursor.fetchall()
    words = ["".join(word) for word in fetched_words]
    return words

game_unique_count_map = {}
# gets the words for the game
while True:
    random_words = get_four_random_words()
    count_map = {}
    
    bad_draw = False
    for i, word in enumerate(random_words):
        
        current_letters = set(word)
        other_letters = set()
        # loop through the other words
        for j, other_word in enumerate(random_words):
            if i == j:
                continue
            other_letters.update(set(random_words[j]))
        # other_letters contains a set of letters from the other words (not current word)
        if len(current_letters.intersection(other_letters)) == 0:
            # if the current word shares no letters with any of the other words, 
            # it was a bad draw
            bad_draw = True
            break
        
    
        # loop through the letters of the current word
        for letter in word:
            count_map[letter] = count_map.get(letter, 0) + 1
    
    # get how many letters have a count of 1
    unique_count = sum(1 for count in count_map.values() if count == 1)
    # print(random_words)
    # print(count_map)
    # print(f"Unique count: {unique_count}")
    # input()
    # if not bad_draw:
    #     game_unique_count_map[unique_count] = game_unique_count_map.get(unique_count, 0) + 1
        # print(random_words, unique_count)
    if unique_count == 7 and not bad_draw: break


# convert map to list and sort it by value
# sorted_game_unique_count_map = sorted(game_unique_count_map.items(), key=lambda x: x[1], reverse=True)
# print(sorted_game_unique_count_map)

symbol_map = {}
symbols = ['!', '@', '#', '$', '%', '^', '&', '*']
for key, value in count_map.items():
    if value > 1:
        # grab a random symbol from symbols and remove it from the list
        symbol = random.choice(symbols)
        symbols.remove(symbol)
        symbol_map[key] = symbol

for word in random_words:
    for letter in word:
        print(symbol_map.get(letter, letter), end="")
    print('\n')

# turn count map into list and sort by value
# sorted_count_map = sorted(count_map.items(), key=lambda x: x[1], reverse=True)
# for key, value in sorted_count_map:
#     if value == 1: 
#         continue
#     input("show hint")
#     print(f"{key}: {symbol_map[key]}")

input("enter to show words")
print(random_words)

