import sys
import sqlite3

def main():
    if len(sys.argv) != 2:
        print("Usage: python script.py <word>")
        sys.exit(1)

    word = sys.argv[1]
    if len(word) != 5:
        print("The word is not valid.")
        sys.exit(1)

    letters = tuple(word)

    db_path = "database.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute('''
    SELECT COUNT(*)
    FROM words
    WHERE first_letter = ? AND second_letter = ? AND third_letter = ? AND fourth_letter = ? AND fifth_letter = ?
    ''', letters)

    count = cursor.fetchone()[0]

    if count > 0:
        print("The word is valid.")
    else:
        print("The word is not valid.")

if __name__ == "__main__":
    main()
