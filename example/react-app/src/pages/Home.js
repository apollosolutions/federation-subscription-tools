import { Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import moment from "moment";
import React, { useEffect } from "react";

import { GetPosts } from "../graphql/queries";
import { PostAdded } from "../graphql/subscriptions";

function Home() {
  const { data, loading, subscribeToMore } = useQuery(GetPosts);

  useEffect(() => {
    const unsubscribe = subscribeToMore({
      document: PostAdded,
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) {
          return prev;
        }
        return {
          posts: [...prev.posts, subscriptionData.data.postAdded]
        };
      }
    });
    return () => unsubscribe();
  }, [subscribeToMore]);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <nav>
        <p>
          <Link to="/post/add">Add a Post</Link>
        </p>
      </nav>
      {data?.posts?.length ? (
        [...data.posts]
          .filter(post => post !== null)
          .sort((a, b) =>
            Date.parse(b.publishedAt) > Date.parse(a.publishedAt) ? 1 : -1
          )
          .map(({ author, content, id, title, publishedAt }) => (
            <article key={id}>
              <h1>{title}</h1>
              <p>Post ID: {id}</p>
              <p>By {author.name}</p>
              <p>{moment(publishedAt).format("h:mm A MMM D, YYYY")}</p>
              <p>{content}</p>
            </article>
          ))
      ) : (
        <p>No posts available!</p>
      )}
    </div>
  );
}

export default Home;
