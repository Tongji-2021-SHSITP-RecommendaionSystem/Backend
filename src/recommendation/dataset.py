# -*- coding: utf-8 -*-
"""
Created on Wed Oct 28 10:02:24 2020

@author: 1952640
"""

from collections import Counter
import numpy as np
from tensorflow import keras


def open_file(filename, mode='r'):
    # print(os.getcwd())
    # open('../data/val.csv', mode='w').write('\n')
    return open(filename, mode, encoding='utf-8', errors='ignore')


def read_file(filename):
    contents, users, newsids = [], [], []
    with open_file(filename) as f:
        print(f)
        for line in f:
           # print('?')
            # try:
            if 1:
                # print(line.strip().split(','))
                this_line = line.strip().split(',')
                user = "".join(this_line[0])
                newid = this_line[1]
                # print(newid)
                cltime = this_line[2]
                title = this_line[3]
                content = this_line[4]
                # print('ok')
                # print(user)
                # print(title)
                if user:
                    users.append(user)
                if newid:
                    newsids.append(list(newid))
                if title:  # å¦æä¸æ¯ç©ºç
                   # print(list(title))
                    cont = list(title)
                    cont.extend(list(content))
                    contents.append(cont)
                    # contents.append(list(content))
                    # labels.append(label)
            # except:
                # pass
    return contents, users, newsids


def build_vocab(train_dir, vocab_dir, vocab_size=5000):
    data_train, _, __ = read_file(train_dir)
    all_data = []
    # print(data_train)
    for content in data_train:
        # print(content)
        all_data.extend(content)
    counter = Counter(all_data)
    count_pairs = counter.most_common(vocab_size - 1)
    # print(data_train)
    # print(count_pairs)
    words, _ = list(zip(*count_pairs))
    words = ['<PAD>'] + list(words)
    open_file(vocab_dir, mode='w').write('\n'.join(words) + '\n')


def build_vocab(vocab_path):
    with open_file(vocab_path) as file:
        characters = [line.strip() for line in file.readlines()]
    character_ids = dict(zip(characters, range(len(characters))))
    return characters, character_ids


def read_category(categories: list = []):
    catetory_ids = dict(zip(categories, range(len(categories))))
    return categories, catetory_ids


def to_words(content, words):
    return ''.join(words[x] for x in content)


def process_file(filename, word_to_id, cat_to_id, max_length=600):
    contents, users, newsids = read_file(filename)
    data_id = []
    for i in range(len(contents)):
        data_id.append([word_to_id[x] for x in contents[i] if x in word_to_id])
    news = keras.preprocessing.sequence.pad_sequences(data_id, max_length)
    '''
    [1,0,0,0]
    [0,1,0,0]
    ....
    '''
    return news, users  # , y_pad


def batch_iter(news, users, max_length=600, candidate_num=5, click_num=20, batch_size=64):
    user_count = Counter(users)
    i = 0
    tot_news = len(news)
    while (i < tot_news):
        batch_click, batch_candidate, batch_real = [], [], []
        # pad=[0]*max_length
        j = 0
        while(j < batch_size):
            click = int(user_count[users[i]]-2)
            if(click > click_num):
                click = click_num
            if(click <= 3):
                i += user_count[users[i]]
                continue
            input_click = news[i+1:i+click+1]
            input_real = news[i:i+1]
            # print(input_click.shape)
            if(click < click_num):
                pad = np.zeros(
                    shape=(click_num-click, input_click.shape[-1]), dtype=np.int)
                input_click = np.concatenate((input_click, pad))
                # input_click[click_num-1][0]=-1
                # input_click[click_num-1][1]=click
                click = click_num
                # print(input_click.shape)
            # append(input_real)
            # print('--')
            # print(i+user_count[users[i]])
            # print(i+user_count[users[i]]+candidate_num-1)
            # print('--')
            if(i+user_count[users[i]]+candidate_num-1 > tot_news):
                return
            input_candidate = np.concatenate(
                (input_real, news[i+user_count[users[i]]:i+user_count[users[i]]+candidate_num-1]))
            # print(input_click.shape)
            # print(input_candidate.shape)

            if (i+click_num+candidate_num) < tot_news:
                batch_click.append(input_click)
                batch_candidate.append(input_candidate)
                batch_real.append(input_real)
                j += 1
                # yield input_click,input_candidate,input_real
                # yield news[i:i+click_num],news[i+click_num+1:i+click_num+candidate_num],news[i+click_num+1:i+user_count[users[i]]]
            else:
                return
            i += user_count[users[i]]
        yield batch_click, batch_candidate, batch_real


def test_process_file(filename, word_to_id, cat_to_id, max_length=600):
    contents, users, newsids = read_file(filename)
    data_id = []
    for i in range(len(contents)):
        data_id.append([word_to_id[x] for x in contents[i] if x in word_to_id])
        # label_id.append(cat_to_id[labels[i]])
    news = keras.preprocessing.sequence.pad_sequences(data_id, max_length)
    # y_pad = kr.utils.to_categorical(label_id, num_classes=len(cat_to_id))
    return news, users, contents  # , y_pad


def test_batch_iter(news, users, max_length=600, candidate_num=5, click_num=20, batch_size=64):
    user_count = Counter(users)
    i = 0
    tot_news = len(news)
    while (i < tot_news):
        batch_click, batch_candidate, batch_real, userno = [], [], [], []
        # pad=[0]*max_length
        j = 0
        while(j < batch_size):
            no = []
            click = int(user_count[users[i]]-2)
            if(click > click_num):
                click = click_num
            if(click <= 3):
                i += user_count[users[i]]
                continue
            input_click = news[i+1:i+click+1]
            input_real = news[i:i+1]
            # print(input_click.shape)
            no.extend([i+1, i+1+click+1, i, i+user_count[users[i]],
                       i+user_count[users[i]]+candidate_num-1])
            if(click < click_num):
                pad = np.zeros(
                    shape=(click_num-click, input_click.shape[-1]), dtype=np.int)
                input_click = np.concatenate((input_click, pad))
                # input_click[click_num-1][0]=-1
                # input_click[click_num-1][1]=click
                click = click_num
                # print(input_click.shape)
            # append(input_real)
            # print('--')
            # print(i+user_count[users[i]])
            # print(i+user_count[users[i]]+candidate_num-1)
            # print('--')
            if(i+user_count[users[i]]+candidate_num-1 > tot_news):
                return
            input_candidate = np.concatenate(
                (input_real, news[i+user_count[users[i]]:i+user_count[users[i]]+candidate_num-1]))
            # print(input_click.shape)
            # print(input_candidate.shape)
            # click 2 real 1 candidate 2

            if (i+click_num+candidate_num) < tot_news:
                batch_click.append(input_click)
                batch_candidate.append(input_candidate)
                batch_real.append(input_real)
                userno.append(no)
                j += 1
                # yield input_click,input_candidate,input_real
                # yield news[i:i+click_num],news[i+click_num+1:i+click_num+candidate_num],news[i+click_num+1:i+user_count[users[i]]]
            else:
                return
            i += user_count[users[i]]
        yield batch_click, batch_candidate, batch_real, userno


def preprocess(viewed, candidates, character_ids, max_length=600):
    viewed_indexified = []
    for news in viewed:
        viewed_indexified.append([character_ids[char] for char in list(
            news['title']+news['content']) if char in character_ids])
    candidates_indexified = []
    for news in candidates:
        candidates_indexified.append([character_ids[char] for char in list(
            news['title']+news['content']) if char in character_ids])

    viewed_sequence = keras.preprocessing.sequence.pad_sequences(
        viewed_indexified[0:20], max_length)
    if len(viewed) < 20:
        pad = np.zeros((20-len(viewed), max_length), np.int)
        viewed_sequence = np.concatenate((viewed_sequence, pad))
    candidates_sequence = keras.preprocessing.sequence.pad_sequences(
        candidates_indexified, max_length)
    if len(candidates) < 5:
        pad = np.zeros((5-len(candidates), max_length), np.int)
        candidates_sequence = np.concatenate((candidates_sequence, pad))
    return viewed_sequence, candidates_sequence, candidates_sequence[0]
