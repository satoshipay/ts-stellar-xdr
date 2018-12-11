FROM ruby:stretch

WORKDIR /data

ADD ./ruby /data
RUN bundle install

CMD ["rake", "xdr:update"]
